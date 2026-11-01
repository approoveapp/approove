import type { ImportJob, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { configuredImportModel } from "./model";
import { verifyImportMedia } from "./media-receipt";
import { ImportAiError, proposeCalendar, type ImportAiUsage } from "./claude";
import { fileMeta, ImportFileError, type ImportFileMeta, type PreparedImportFile } from "./files";
import { importMediaSchema, importProposalSchema, type ImportMedia, type ImportProposal } from "./proposal";
import { IMPORT_JOB_ERRORS, importJobError, localizeImportJobError } from "./messages";
import { localizedText, type AppLocale } from "@/lib/locale";

/** Acima disso um job em `processing` morreu com a função (timeout, deploy). */
export const STALE_PROCESSING_MS = 10 * 60 * 1000;

const OPEN_STATUSES = ["processing", "review", "committing"];

function monthStart(now: Date) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Importações que contam na cota do mês: tudo, menos falhas que nem chegaram à IA. */
export function countMonthlyImports(organizationId: string, now = new Date(), db: Pick<Prisma.TransactionClient, "importJob"> = prisma) {
  return db.importJob.count({
    where: {
      organizationId,
      createdAt: { gte: monthStart(now) },
      NOT: { status: "failed", inputTokens: 0, model: null },
    },
  });
}

/** Data de hoje no fuso da agência, para o modelo resolver "próxima segunda" e anos omitidos. */
function todayInSaoPaulo(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

export async function createImportJob(input: {
  organizationId: string;
  clientId: string;
  calendarVersionId: string;
  createdByUserId: string;
  files: PreparedImportFile[];
  media: ImportMedia[];
  quotaLimit: number | null;
  locale: AppLocale;
}) {
  const tr = (pt: string, en: string) => localizedText(input.locale, pt, en);
  return prisma.$transaction(async tx => {
    // Serialize admission per organization before reading quota or client state.
    await tx.organization.update({ where: { id: input.organizationId }, data: { id: input.organizationId } });
    for (const item of input.media) {
      // Recheck expiry under the admission lock. A receipt is admitted into one job only;
      // otherwise cleanup of a discarded job could race reuse by another job.
      if (!verifyImportMedia(item, input.organizationId, input.clientId)) throw new ApiError(400, tr("Mídia expirada ou sem origem válida. Reenvie o arquivo.", "Media expired or has no valid origin. Upload the file again."));
      const reused = await tx.importJob.findFirst({where:{organizationId:input.organizationId,mediaJson:{contains:JSON.stringify(item.url)}},select:{id:true}});
      if (reused) throw new ApiError(409, tr("Esta mídia já pertence a outra importação. Reenvie o arquivo.", "This media already belongs to another import. Upload the file again."));
    }
    const running = await tx.importJob.findFirst({ where: {
      clientId: input.clientId, status: "processing", createdAt: { gt: new Date(Date.now() - STALE_PROCESSING_MS) },
    } });
    if (running) throw new ApiError(409, tr("Já existe uma importação em andamento para este cliente", "An import is already in progress for this client"));
    const used = await countMonthlyImports(input.organizationId, new Date(), tx);
    if (input.quotaLimit !== null && used >= input.quotaLimit) throw new ApiError(403, tr("Limite de importações do plano atingido", "Your plan's AI import quota has been reached"), "PLAN_LIMIT_REACHED");
    return tx.importJob.create({
      data: {
        organizationId: input.organizationId,
        clientId: input.clientId,
        calendarVersionId: input.calendarVersionId,
        createdByUserId: input.createdByUserId,
        filesJson: JSON.stringify(input.files.map(fileMeta)),
        mediaJson: JSON.stringify(input.media),
      },
    });
  });
}

/** Roda depois da resposta (`after`). Nunca lança: todo desfecho fica gravado no job. */
export async function runImportJob(
  jobId: string,
  /** `locale` is the requester's, captured at admission: failures and warnings persist in it. */
  input: { clientName: string; files: PreparedImportFile[]; media: ImportMedia[]; locale: AppLocale }
) {
  try {
    const claimed = await prisma.importJob.updateMany({
      where: { id: jobId, status: "processing", model: null, createdAt: { gt: new Date(Date.now() - STALE_PROCESSING_MS) } },
      data: { model: configuredImportModel(process.env.ANTHROPIC_IMPORT_MODEL) ?? "unconfigured" },
    });
    if (!claimed.count) return; // Do not repeat an attempted inference after an uncertain result.
    const result = await proposeCalendar({ ...input, today: todayInSaoPaulo() });
    await prisma.importJob.updateMany({
      where: { id: jobId, status: "processing" },
      data: {
        status: "review",
        resultJson: JSON.stringify(result.proposal),
        ...usageFields(result),
      },
    });
    // Late results record usage, but must never revive an expired/discarded job.
    await prisma.importJob.updateMany({ where: { id: jobId }, data: usageFields(result) });
  } catch (error) {
    const known = error instanceof ImportAiError || error instanceof ImportFileError;
    if (!known) console.error("Import job failed:", jobId);
    await prisma.importJob
      .updateMany({
        where: { id: jobId, status: "processing" },
        data: {
          status: "failed",
          error: known ? error.message : importJobError("unexpected", input.locale),
          ...(error instanceof ImportAiError && error.usage ? usageFields(error.usage) : {}),
        },
      })
      .catch(() => console.error("Import job status update failed:", jobId));
    if (error instanceof ImportAiError && error.usage) {
      await prisma.importJob.updateMany({ where: { id: jobId }, data: usageFields(error.usage) }).catch(() => undefined);
    }
  }
}

function usageFields(usage: ImportAiUsage) {
  return { model: usage.model, inputTokens: usage.inputTokens, outputTokens: usage.outputTokens };
}

/** Marca como falho um job que ficou preso em `processing`. Devolve o job atualizado. */
export async function expireIfStale(job: ImportJob, now = new Date()) {
  if (!["processing", "committing"].includes(job.status)) return job;
  const since = job.status === "committing" ? job.updatedAt : job.createdAt;
  if (now.getTime() - since.getTime() < STALE_PROCESSING_MS) return job;
  await prisma.importJob.updateMany({
    where: { id: job.id, status: job.status, updatedAt: job.updatedAt },
    data: job.status === "committing"
      ? { status: "review", error: null }
      // No requester here; `serializeImportJob` shows this fixed text in the viewer's locale.
      : { status: "failed", error: IMPORT_JOB_ERRORS.interrupted[0] },
  });
  return (await prisma.importJob.findUnique({ where: { id: job.id } })) ?? job;
}

/** Job aberto mais recente do cliente (em andamento ou aguardando revisão). */
export async function findOpenImportJob(clientId: string) {
  const job = await prisma.importJob.findFirst({
    where: { clientId, status: { in: OPEN_STATUSES } },
    orderBy: { createdAt: "desc" },
  });
  if (!job) return null;
  const current = await expireIfStale(job);
  return OPEN_STATUSES.includes(current.status) ? current : null;
}

function parseJson<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function parseImportMedia(job: Pick<ImportJob, "mediaJson">): ImportMedia[] {
  const parsed = importMediaSchema.array().safeParse(parseJson(job.mediaJson, []));
  return parsed.success ? parsed.data : [];
}

export function serializeImportJob(job: ImportJob, locale: AppLocale) {
  const parsed = importProposalSchema.safeParse(parseJson(job.resultJson, null));
  return {
    id: job.id,
    status: job.status,
    error: localizeImportJobError(job.error, locale),
    files: parseJson<ImportFileMeta[]>(job.filesJson, []),
    media: parseImportMedia(job),
    proposal: parsed.success ? (parsed.data as ImportProposal) : null,
    postsCreated: job.postsCreated,
    createdAt: job.createdAt.toISOString(),
  };
}

export type SerializedImportJob = ReturnType<typeof serializeImportJob>;
