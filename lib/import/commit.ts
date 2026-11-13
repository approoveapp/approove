import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";
import { sha256 } from "@/lib/crypto-tokens";
import { buildSlideCreates } from "@/lib/attachment-slides";
import { parseImportMedia } from "./jobs";
import { verifyImportMedia } from "./media-receipt";
import { DEFAULT_LOCALE, localizedText, type AppLocale } from "@/lib/locale";
import { attachmentTypeFor, importStageFor, importFormatLabel, type ImportCommitPost, type ImportMedia, boundedProposalSchema } from "./proposal";

function postCreate(tx: Prisma.TransactionClient, post: ImportCommitPost, calendarVersionId: string, media: ImportMedia[], locale: AppLocale) {
  const copyText = post.copyText;
  const slides = media.map((item) => ({ url: item.url, mediaType: item.mediaType }));
  const type = attachmentTypeFor(post.format, post.channel, slides.length);

  return tx.postItem.create({
    data: {
      calendarVersionId,
      scheduledAt: new Date(post.scheduledAt),
      channel: post.channel,
      title: post.title,
      copyText,
      status: "pending",
      productionStage: importStageFor(copyText.trim().length > 0, slides.length > 0, post.textOnly),
      handoffNote: post.handoffNote || null,
      ...(slides.length > 0 && {
        attachments: {
          create: {
            type,
            label: type === "other" ? importFormatLabel(post.format, locale) : null,
            order: 0,
            versions: {
              create: { url: slides[0].url, version: 1, slides: { create: buildSlideCreates(slides) } },
            },
          },
        },
      }),
    },
    select: { id: true },
  });
}


/** Claim, posts and receipt share one transaction: a crash rolls all of them back. */
export async function commitImport(jobId: string, organizationId: string, posts: ImportCommitPost[], locale: AppLocale = DEFAULT_LOCALE) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const fingerprint = sha256(JSON.stringify(posts));
  return prisma.$transaction(async tx => {
    // First operation is a conditional write, serializing competing SQLite writers.
    const claim = await tx.importJob.updateMany({ where: { id: jobId, organizationId, status: "review" }, data: { status: "committing" } });
    const job = await tx.importJob.findFirst({ where: { id: jobId, organizationId } });
    if (!job) throw new ApiError(404, tr("Importação não encontrada", "Import not found"));
    const result = job.resultJson ? JSON.parse(job.resultJson) : {};
    if (!claim.count) {
      if (job.status === "committed" && result.commitFingerprint === fingerprint) {
        return { created: job.postsCreated, alreadyCommitted: true, mediaJson: job.mediaJson };
      }
      throw new ApiError(409, tr("Esta importação já foi aplicada, descartada ou está sendo confirmada. Atualize o calendário antes de tentar novamente.", "This import was already applied, discarded or is being confirmed. Refresh the calendar before trying again."));
    }
    const proposal = boundedProposalSchema.safeParse(result);
    if (!proposal.success || posts.length > proposal.data.posts.length) throw new ApiError(400, tr("Seleção sem proposta válida. Refaça a importação.", "The selection has no valid proposal. Run the import again."));
    const indexes = posts.map((post,i) => post.sourceIndex ?? i);
    if (new Set(indexes).size !== indexes.length || indexes.some(i => i >= proposal.data.posts.length)) throw new ApiError(400, tr("Referências de revisão inválidas.", "Invalid review references."));
    const mediaByName = new Map(parseImportMedia(job).map(item => [item.name, item]));
    for (const post of posts) {
      const media = post.media.map(name => mediaByName.get(name));
      if (media.some(item => !item)) throw new ApiError(400, tr("Mídia não pertence a esta importação", "Media does not belong to this import"));
      if (media.some(item => !verifyImportMedia(item!, organizationId, job.clientId, { admitted: true }))) {
        throw new ApiError(400, tr("Não foi possível comprovar a origem desta mídia. Reenvie os arquivos em uma nova importação.", "The origin of this media could not be verified. Upload the files again in a new import."));
      }
      await postCreate(tx, post, job.calendarVersionId, media as ImportMedia[], locale);
    }
    await tx.importJob.update({ where: { id: job.id }, data: {
      status: "committed", postsCreated: posts.length, committedAt: new Date(),
      resultJson: JSON.stringify({ ...result, commitFingerprint: fingerprint }),
    } });
    return { created: posts.length, alreadyCommitted: false, mediaJson: job.mediaJson };
  }, { maxWait: 10000, timeout: 30000 });
}
