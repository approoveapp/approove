import { prisma } from "@/lib/prisma";
import { deleteMedia, listImportMedia, type StoredMedia } from "@/lib/media-storage";
import { parseImportMedia, STALE_PROCESSING_MS } from "./jobs";

/** Upload sem job (usuário fechou a janela no meio do envio) espera isso antes de sair. */
export const ORPHAN_GRACE_MS = 24 * 60 * 60 * 1000;
/** Proposta esquecida em revisão é descartada depois disso, liberando as artes. */
export const REVIEW_EXPIRY_MS = 14 * 24 * 60 * 60 * 1000;

const OPEN_STATUSES = ["processing", "review", "committing"];
const IMPORT_MARK = "/import-";

/** URLs de mídia citadas num snapshot de aprovação (JSON com campos "url"). */
export function snapshotMediaUrls(snapshot: string): string[] {
  return [...snapshot.matchAll(/"url":"([^"]+)"/g)].map((match) => match[1]);
}

/**
 * Quais mídias apagar. Nunca uma protegida (em post, versão, snapshot ou job aberto).
 * Das demais: a de job encerrado sai já; a que nenhum job conhece espera a carência.
 */
export function pickImportMediaToDelete(input: {
  stored: StoredMedia[];
  protectedUrls: Set<string>;
  closedJobUrls: Set<string>;
  now: Date;
}) {
  return input.stored
    .filter(({ url, uploadedAt }) => {
      if (input.protectedUrls.has(url)) return false;
      if (input.closedJobUrls.has(url)) return true;
      return input.now.getTime() - uploadedAt.getTime() > ORPHAN_GRACE_MS;
    })
    .map(({ url }) => url);
}

/** Mídias de importação em uso: material de post (qualquer versão), histórico ou job aberto. */
async function protectedMediaUrls() {
  const [slides, versions, events, openJobs] = await Promise.all([
    prisma.attachmentSlide.findMany({ where: { url: { contains: IMPORT_MARK } }, select: { url: true } }),
    prisma.attachmentVersion.findMany({ where: { url: { contains: IMPORT_MARK } }, select: { url: true } }),
    prisma.postStatusEvent.findMany({
      where: { creativesSnapshot: { contains: IMPORT_MARK } },
      select: { creativesSnapshot: true },
    }),
    prisma.importJob.findMany({ where: { status: { in: OPEN_STATUSES } }, select: { mediaJson: true } }),
  ]);
  return new Set([
    ...slides.map((row) => row.url),
    ...versions.map((row) => row.url),
    ...events.flatMap((row) => snapshotMediaUrls(row.creativesSnapshot ?? "")),
    ...openJobs.flatMap((job) => parseImportMedia(job).map((item) => item.url)),
  ]);
}

/**
 * Depois do commit ou do descarte: apaga as mídias do job que não viraram material.
 * Roda em `after()`; nunca lança, porque o cron diário cobre o que falhar aqui.
 */
export async function cleanupJobMedia(job: { mediaJson: string }) {
  try {
    const urls = parseImportMedia(job).map((item) => item.url);
    if (urls.length === 0) return;
    const keep = await protectedMediaUrls();
    await deleteMedia(urls.filter((url) => !keep.has(url)));
  } catch {
    console.error("Import media cleanup failed");
  }
}

/** Faxina diária (cron): propostas esquecidas e mídias que nenhum post usa. */
export async function cleanupImportMedia(now = new Date()) {
  // Abandoned tabs must not leave uploads protected forever. A late result cannot revive these jobs.
  await prisma.importJob.updateMany({where:{status:"processing",createdAt:{lt:new Date(now.getTime()-STALE_PROCESSING_MS)}},
    data:{status:"failed",error:"A importação foi interrompida. A chamada pode ter sido cobrada; não houve repetição automática."}});
  await prisma.importJob.updateMany({where:{status:"committing",updatedAt:{lt:new Date(now.getTime()-STALE_PROCESSING_MS)}},data:{status:"review",error:null}});
  const expired = await prisma.importJob.updateMany({
    where: { status: "review", createdAt: { lt: new Date(now.getTime() - REVIEW_EXPIRY_MS) } },
    data: { status: "discarded", resultJson: null },
  });

  const [stored, protectedUrls, closedJobs] = await Promise.all([
    listImportMedia(),
    protectedMediaUrls(),
    prisma.importJob.findMany({
      where: { status: { notIn: OPEN_STATUSES }, mediaJson: { not: "[]" } },
      select: { mediaJson: true },
    }),
  ]);
  const closedJobUrls = new Set(closedJobs.flatMap((job) => parseImportMedia(job).map((item) => item.url)));

  const toDelete = pickImportMediaToDelete({ stored, protectedUrls, closedJobUrls, now });
  await deleteMedia(toDelete);

  return { expiredReviews: expired.count, checked: stored.length, deleted: toDelete.length };
}
