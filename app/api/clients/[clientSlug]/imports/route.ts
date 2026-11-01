import { indexTabularSources } from "@/lib/import/tabular-integrity";
import { boundedImportFormData } from "@/lib/import/request";
import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getEffectivePlan } from "@/lib/billing-access";
import { getPlanLimit } from "@/lib/plan-limits";
import { isImportAiConfigured } from "@/lib/import/claude";
import { verifyImportMedia } from "@/lib/import/media-receipt";
import { importMediaSchema, MAX_IMPORT_MEDIA } from "@/lib/import/proposal";
import {
  ImportFileError,
  MAX_IMPORT_BYTES,
  MAX_IMPORT_FILES,
  MAX_IMPORT_TEXT_CHARS,
  prepareImportFile,
  totalTextChars,
  type PreparedImportFile,
} from "@/lib/import/files";
import {
  countMonthlyImports,
  createImportJob,
  findOpenImportJob,
  runImportJob,
  serializeImportJob,
} from "@/lib/import/jobs";

// O processamento roda em `after()` dentro desta mesma invocação.
export const maxDuration = 300;

const MAX_MB = MAX_IMPORT_BYTES / (1024 * 1024);

async function findClient(clientSlug: string, organizationId: string) {
  return prisma.client.findFirst({
    where: { slug: clientSlug, organizationId },
    select: {
      id: true,
      name: true,
      versions: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } },
    },
  });
}

/** Importação aberta do cliente (para retomar a revisão) e a cota do mês. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  try {
    const { organization } = await requireActiveOrganization();
    const { clientSlug } = await params;

    const client = await findClient(clientSlug, organization.id);
    if (!client) {
      return NextResponse.json({ error: tr("Cliente não encontrado", "Client not found") }, { status: 404 });
    }

    const [job, used] = await Promise.all([
      findOpenImportJob(client.id),
      countMonthlyImports(organization.id),
    ]);

    return NextResponse.json({
      job: job ? serializeImportJob(job, locale) : null,
      quota: { used, limit: getPlanLimit(getEffectivePlan(organization), "aiImports") },
      configured: isImportAiConfigured(),
    });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching import:");
    return NextResponse.json({ error: tr("Erro interno do servidor", "Internal server error") }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  try {
    const { user, organization } = await requireActiveOrganization();
    const { clientSlug } = await params;

    if (!isImportAiConfigured()) {
      return NextResponse.json(
        { error: tr("Importação com IA não configurada. Defina ANTHROPIC_API_KEY no ambiente.", "Import with AI is not configured. Set ANTHROPIC_API_KEY in the environment.") },
        { status: 503 }
      );
    }

    await enforceRateLimit("importUser", user.id);

    const client = await findClient(clientSlug, organization.id);
    const calendarVersion = client?.versions[0];
    if (!client || !calendarVersion) {
      return NextResponse.json({ error: tr("Calendário não encontrado", "Calendar not found") }, { status: 404 });
    }

    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_IMPORT_BYTES + 64 * 1024) {
      return NextResponse.json(
        { error: tr(`Arquivos grandes demais. Máximo: ${MAX_MB} MB no total.`, `Files are too large. Maximum: ${MAX_MB} MB in total.`) },
        { status: 413 }
      );
    }

    const formData = await boundedImportFormData(request, MAX_IMPORT_BYTES + 64 * 1024, locale);
    const uploads = formData.getAll("files").filter((item): item is File => item instanceof File);
    const media = importMediaSchema
      .array()
      .max(MAX_IMPORT_MEDIA, tr(`Máximo de ${MAX_IMPORT_MEDIA} imagens e vídeos por importação`, `Maximum of ${MAX_IMPORT_MEDIA} images and videos per import`))
      .parse(JSON.parse(String(formData.get("media") ?? "[]")));

    if (media.some(item => !item.size) || media.reduce((n,item) => n+(item.size ?? 0),0) > 16 * 1024 * 1024) {
      return NextResponse.json({error:tr("Reenvie as mídias; máximo de 16 MB no conjunto.", "Upload the media again; maximum of 16 MB in total.")},{status:400});
    }
    if (media.some((item) => !verifyImportMedia(item, organization.id, client.id))) {
      return NextResponse.json({ error: tr("Mídia inválida", "Invalid media") }, { status: 400 });
    }
    if (new Set(media.map((item) => item.name)).size !== media.length) {
      return NextResponse.json({ error: tr("Há duas mídias com o mesmo nome", "Two media files have the same name") }, { status: 400 });
    }
    if (uploads.length === 0 && media.length === 0) {
      return NextResponse.json({ error: tr("Envie ao menos um arquivo", "Upload at least one file") }, { status: 400 });
    }
    if (uploads.length > MAX_IMPORT_FILES) {
      return NextResponse.json(
        { error: tr(`Máximo de ${MAX_IMPORT_FILES} arquivos por importação`, `Maximum of ${MAX_IMPORT_FILES} files per import`) },
        { status: 400 }
      );
    }
    if (uploads.reduce((sum, file) => sum + file.size, 0) > MAX_IMPORT_BYTES) {
      return NextResponse.json(
        { error: tr(`Arquivos grandes demais. Máximo: ${MAX_MB} MB no total.`, `Files are too large. Maximum: ${MAX_MB} MB in total.`) },
        { status: 413 }
      );
    }

    const files: PreparedImportFile[] = [];
    const parsingDeadline=Date.now()+30000;
    // Sequential parsing bounds concurrent decompression/worker memory.
    for (const file of uploads) {
      if(Date.now()>parsingDeadline) throw new ImportFileError(tr("Tempo total de leitura excedido; divida os arquivos.", "Total reading time exceeded; split the files."));
      files.push(await prepareImportFile(file.name.slice(0,200), new Uint8Array(await file.arrayBuffer()), locale));
    }
    try { indexTabularSources(files); } catch { throw new ImportFileError(tr("Há valores sem cabeçalho ou colunas ambíguas. Regularize a tabela antes de importar.", "There are values without a header or ambiguous columns. Fix the table before importing.")); }
    if (totalTextChars(files) > MAX_IMPORT_TEXT_CHARS) {
      return NextResponse.json(
        { error: tr("Os arquivos têm texto demais para uma importação. Divida em partes.", "The files have too much text for one import. Split them into parts.") },
        { status: 400 }
      );
    }

    const plan = getEffectivePlan(organization);
    const job = await createImportJob({
      organizationId: organization.id,
      clientId: client.id,
      calendarVersionId: calendarVersion.id,
      createdByUserId: user.id,
      files,
      media,
      quotaLimit: getPlanLimit(plan, "aiImports"),
      locale,
    });

    // The requester's locale travels with the job: its failures and warnings are written in it.
    after(() => runImportJob(job.id, { clientName: client.name, files, media, locale }));

    return NextResponse.json({ job: serializeImportJob(job, locale) }, { status: 202 });
  } catch (error) {
    if (error instanceof ImportFileError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error starting import:");
    return NextResponse.json({ error: tr("Erro interno do servidor", "Internal server error") }, { status: 500 });
  }
}
