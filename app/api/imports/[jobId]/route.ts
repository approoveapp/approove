import { after, NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { cleanupJobMedia } from "@/lib/import/cleanup";
import { expireIfStale, serializeImportJob } from "@/lib/import/jobs";

/** Status da importação; a tela consulta enquanto a IA trabalha. */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  try {
    const { organization } = await requireActiveOrganization();
    const { jobId } = await params;

    const job = await prisma.importJob.findFirst({
      where: { id: jobId, organizationId: organization.id },
    });
    if (!job) {
      return NextResponse.json({ error: tr("Importação não encontrada", "Import not found") }, { status: 404 });
    }

    return NextResponse.json({ job: serializeImportJob(await expireIfStale(job), locale) });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error fetching import job:");
    return NextResponse.json({ error: tr("Erro interno do servidor", "Internal server error") }, { status: 500 });
  }
}

/** Descarta a proposta e apaga as artes enviadas. A cota do mês continua usada. */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  try {
    const { organization } = await requireActiveOrganization();
    const { jobId } = await params;

    const { count } = await prisma.importJob.updateMany({
      where: { id: jobId, organizationId: organization.id, status: { in: ["review", "failed"] } },
      data: { status: "discarded", resultJson: null },
    });
    if (count === 0) {
      return NextResponse.json(
        { error: tr("Importação não encontrada ou ainda em andamento", "Import not found or still in progress") },
        { status: 404 }
      );
    }

    after(async () => {
      const job = await prisma.importJob.findUnique({ where: { id: jobId }, select: { mediaJson: true } });
      if (job) await cleanupJobMedia(job);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Error discarding import job:");
    return NextResponse.json({ error: tr("Erro interno do servidor", "Internal server error") }, { status: 500 });
  }
}
