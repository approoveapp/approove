import { z } from "zod";
import { isoDateSchema } from "@/lib/validation";
import type { ProductionStage } from "@/lib/production-stages";
import { localizedText, type AppLocale } from "@/lib/locale";

/** Usado no servidor e na tela de revisão: nada aqui pode depender de Node. */

export const IMPORT_CHANNELS = [
  "Instagram",
  "Facebook",
  "LinkedIn",
  "TikTok",
  "Twitter/X",
  "YouTube",
] as const;

export const IMPORT_FORMATS = [
  "feed",
  "carousel",
  "reels",
  "stories",
  "video",
  "article",
  "other",
] as const;

export type ImportFormat = (typeof IMPORT_FORMATS)[number];

export const IMPORT_FORMAT_LABELS: Record<ImportFormat, string> = {
  feed: "Feed",
  carousel: "Carrossel",
  reels: "Reels",
  stories: "Stories",
  video: "Vídeo",
  article: "Artigo",
  other: "Outro",
};

const IMPORT_FORMAT_LABELS_EN: Record<ImportFormat, string> = {
  feed: "Feed",
  carousel: "Carousel",
  reels: "Reels",
  stories: "Stories",
  video: "Video",
  article: "Article",
  other: "Other",
};

export function importFormatLabel(format: ImportFormat, locale: AppLocale) {
  return localizedText(locale, IMPORT_FORMAT_LABELS[format] ?? format, IMPORT_FORMAT_LABELS_EN[format] ?? format);
}

/** Hora usada quando o documento não diz (a mesma do clique no calendário). */
export const DEFAULT_IMPORT_TIME = "10:00";

export const MAX_IMPORT_MEDIA = 30;

/**
 * Formato exigido do modelo (structured outputs). Sem limites de tamanho aqui:
 * a API não os aplica, e o SDK falharia o parse. Os limites ficam no commit.
 */
export const importProposalSchema = z.object({
  summary: z
    .string()
    .describe("Resumo em 1-2 frases do que foi encontrado nos arquivos, no idioma da equipe."),
  posts: z.array(
    z.object({
      date: z.string().describe("Data da publicação no formato YYYY-MM-DD."),
      time: z
        .string()
        .nullable()
        .describe("Horário HH:MM (24h) se o documento indicar; senão null."),
      dateIsSuggested: z
        .boolean()
        .describe("true quando a data não está escrita nos arquivos e foi deduzida por você."),
      channel: z.enum(IMPORT_CHANNELS),
      format: z.enum(IMPORT_FORMATS),
      title: z.string().describe("Tema ou título do post, como está no documento."),
      copyText: z
        .string()
        .describe("Legenda exatamente como está no documento. Vazio quando o documento não traz."),
      media: z
        .array(z.string())
        .describe(
          "Nomes exatos dos arquivos de mídia que são a arte deste post, na ordem de publicação " +
            "(carrossel = ordem dos slides). Vazio quando nenhuma mídia enviada é deste post."
        ),
      notes: z
        .string()
        .nullable()
        .describe("Orientações do documento para o time (referências, hashtags, CTA), se houver."),
      source: z.string().describe("Arquivo e local de onde o post saiu, ex.: \"briefing.pdf, p. 3\"."),
    })
  ),
  warnings: z
    .array(z.string())
    .describe("Ambiguidades, conflitos ou informações faltando que o time precisa conferir."),
});

/**
 * Request schema when tables were indexed: each post names its source row in its own field.
 * Structured outputs make the field mandatory (a marker inside free-text source was often
 * dropped); the SDK sends the id list as a description, so ids are still checked after the call.
 */
export function importProposalSchemaFor(sourceIds: readonly string[], required: boolean) {
  if (!sourceIds.length) return importProposalSchema;
  const ref = z.enum(sourceIds as [string, ...string[]]).describe("Identificador da linha da tabela de onde o post saiu.");
  return importProposalSchema.extend({
    posts: z.array(importProposalSchema.shape.posts.element.extend({
      sourceRef: required ? ref : ref.nullable().describe("Identificador da linha da tabela; null quando o post não saiu de uma tabela."),
    })),
  });
}

/** Runtime limits are separate from the provider's structured-output subset. */
export const boundedProposalSchema = importProposalSchema.extend({
  summary: z.string().max(2000), warnings: z.array(z.string().max(2000)).max(100),
  posts: z.array(importProposalSchema.shape.posts.element.extend({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value, "Data inválida"),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable(),
    title: z.string().max(300), copyText: z.string().max(10000),
    notes: z.string().max(2000).nullable(), source: z.string().max(1000),
    media: z.array(z.string().max(200)).max(MAX_IMPORT_MEDIA),
  })).max(200),
});

export type ImportProposal = z.infer<typeof importProposalSchema>;
export type ImportProposalPost = ImportProposal["posts"][number];

/** Mídia enviada na importação, já gravada no storage. */
export const importMediaSchema = z.object({
  name: z.string().trim().min(1).max(200),
  url: z.string().min(1).max(2048),
  mediaType: z.enum(["image", "video"]),
  mime: z.string().max(100),
  size: z.number().int().positive().max(4 * 1024 * 1024).optional(),
  receipt: z.string().max(200).optional(),
});

export type ImportMedia = z.infer<typeof importMediaSchema>;

/** Tipo de material (PostAttachment.type) que corresponde ao formato do post. */
export function attachmentTypeFor(format: ImportFormat, channel: string, mediaCount: number) {
  if (format === "carousel" && mediaCount >= 2) return "carousel";
  if (format === "stories") return "post_stories";
  if (format === "reels") return "reels_cover";
  if ((format === "feed" || format === "article") && channel === "LinkedIn") return "post_linkedin";
  if (format === "feed" || format === "carousel") return "post_feed";
  return "other";
}

/**
 * Etapa de produção pelo que veio pronto. Nunca "ready_for_client": o post só chega
 * ao cliente depois que o time conferir.
 */
export function importStageFor(hasCopy: boolean, hasMedia: boolean, textOnly = false): ProductionStage {
  if (hasCopy && (hasMedia || textOnly)) return "internal_review";
  if (hasCopy) return "waiting_design";
  return "draft_copy";
}

/** Nota de produção do post criado: origem, formato e orientações do documento. */
export function buildImportNote(post: Pick<ImportProposalPost, "format" | "source" | "notes">, locale: AppLocale) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const parts = [
    tr("Importado com IA", "Imported with AI"),
    `${tr("Formato", "Format")}: ${importFormatLabel(post.format, locale)}`,
    post.source && `${tr("Fonte", "Source")}: ${post.source}`,
    post.notes?.trim(),
  ].filter(Boolean);
  return parts.join(" · ").slice(0, 2000);
}

/** Valor de `<input type="datetime-local">` (hora local de quem revisa). */
export function proposalLocalDateTime(post: ImportProposalPost) {
  const time = post.time && /^\d{2}:\d{2}$/.test(post.time) ? post.time : DEFAULT_IMPORT_TIME;
  return `${post.date}T${time}`;
}

/** Mídias enviadas que nenhum post da proposta usa. */
export function unusedMediaNames(media: ImportMedia[], posts: Pick<ImportProposalPost, "media">[]) {
  const used = new Set(posts.flatMap((post) => post.media));
  return media.map((item) => item.name).filter((name) => !used.has(name));
}

/** O que a tela de revisão envia: posts já conferidos e editados pelo usuário. */
export function importCommitSchemaFor(locale: AppLocale) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  return z.object({
    reviewAcknowledged: z.literal(true, { error: tr("Confira a fonte, os avisos e as mídias antes de confirmar.", "Check the source, the warnings and the media before confirming.") }),
    posts: z
      .array(
        z.object({
          sourceIndex: z.number().int().min(0).max(199).optional(),
          scheduledAt: isoDateSchema,
          channel: z.enum(IMPORT_CHANNELS),
          format: z.enum(IMPORT_FORMATS),
          title: z.string().trim().max(300),
          copyText: z.string().max(10000),
          // Decisão explícita de quem revisa; ausência de arte sozinha não basta.
          textOnly: z.boolean().default(false),
          handoffNote: z.string().trim().max(2000).optional(),
          // Nomes das mídias da importação; o servidor resolve as URLs pelo job.
          media: z.array(z.string().max(200)).max(MAX_IMPORT_MEDIA).default([]),
        })
      )
      .min(1, tr("Selecione ao menos uma publicação", "Select at least one post"))
      .max(200, tr("Máximo de 200 publicações por importação", "Maximum of 200 posts per import")),
  });
}

/** Mensagens em português; as rotas usam `importCommitSchemaFor(locale)`. */
export const importCommitSchema = importCommitSchemaFor("pt-BR");

export type ImportCommitPost = z.infer<typeof importCommitSchema>["posts"][number];
