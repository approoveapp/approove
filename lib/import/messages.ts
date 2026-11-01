import { localizedText, type AppLocale } from "@/lib/locale";

/**
 * Fixed job failure texts as [pt-BR, en]. The job runs in `after()` and persists the text in the
 * requester's locale (captured at admission). Stale-job expiry and the cron have no requester, so
 * they keep writing Portuguese. `localizeImportJobError` re-renders any of these texts in the
 * viewer's locale, including rows persisted before the English copy existed.
 */
export const IMPORT_JOB_ERRORS = {
  interrupted: [
    "A importação foi interrompida. Uma chamada de IA pode ter sido cobrada; não há repetição automática. Confira antes de reenviar.",
    "The import was interrupted. An AI call may have been charged; there is no automatic retry. Check before resubmitting.",
  ],
  interruptedByCleanup: [
    "A importação foi interrompida. A chamada pode ter sido cobrada; não houve repetição automática.",
    "The import was interrupted. The call may have been charged; it was not retried automatically.",
  ],
  unexpected: [
    "Erro ao processar a importação. A chamada à IA pode ter sido cobrada; não houve repetição automática.",
    "Error processing the import. The AI call may have been charged; it was not retried automatically.",
  ],
  mediaReadTimeout: [
    "Tempo de leitura das mídias excedido; divida o envio.",
    "Reading the media took too long; split the upload.",
  ],
  mediaUnreadable: [
    "Não foi possível ler uma mídia privada admitida. Reenvie a importação.",
    "An uploaded private media file could not be read. Resubmit the import.",
  ],
  unconfigured: [
    "A configuração da importação está indisponível. Contate o administrador.",
    "Import configuration is unavailable. Contact your administrator.",
  ],
  inputTooLarge: [
    "Os arquivos e as mídias desta importação são grandes demais para uma leitura. Divida em partes.",
    "The files and media in this import are too large to read at once. Split them into parts.",
  ],
  refusal: [
    "A IA não conseguiu processar estes arquivos.",
    "The AI could not process these files.",
  ],
  tooManyPosts: [
    "Os arquivos geram publicações demais para uma importação. Divida em partes.",
    "These files produce too many posts for one import. Split them into parts.",
  ],
  unexpectedFormat: [
    "A IA devolveu uma resposta em formato inesperado. Tente de novo.",
    "The AI returned a response in an unexpected format. Try again.",
  ],
  invalidFields: [
    "A resposta excedeu os limites ou trouxe campos inválidos. Divida ou revise a fonte.",
    "The response exceeded the limits or contained invalid fields. Split or review the source.",
  ],
  unknownMedia: [
    "A resposta citou mídias ausentes ou repetidas no mesmo post. Nenhuma publicação foi criada.",
    "The response referenced missing media, or the same media twice in one post. No posts were created.",
  ],
  tooManyWarnings: [
    "A proposta excedeu o limite de avisos; divida os arquivos.",
    "The proposal exceeded the warning limit; split the files.",
  ],
} as const satisfies Record<string, readonly [string, string]>;

export type ImportJobErrorKey = keyof typeof IMPORT_JOB_ERRORS;

export function importJobError(key: ImportJobErrorKey, locale: AppLocale) {
  const [pt, en] = IMPORT_JOB_ERRORS[key];
  return localizedText(locale, pt, en);
}

/** Viewer-locale text for a persisted job error. Unknown (parameterized) texts pass through as stored. */
export function localizeImportJobError(error: string | null, locale: AppLocale): string | null {
  if (!error) return error;
  for (const [pt, en] of Object.values(IMPORT_JOB_ERRORS)) {
    if (error === pt || error === en) return localizedText(locale, pt, en);
  }
  return error;
}
