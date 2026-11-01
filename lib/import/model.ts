/** Explicit server-side choice. Never silently upgrade to a costlier model. */
export const IMPORT_MODELS = [
  "claude-opus-5-5",
  "claude-sonnet-5-5",
  "claude-haiku-5-5",
] as const;
export type ImportModel = (typeof IMPORT_MODELS)[number];
export const DEFAULT_IMPORT_MODEL: ImportModel = "claude-haiku-5-5";

export function configuredImportModel(value: string | undefined): ImportModel | null {
  const model = value?.trim() || DEFAULT_IMPORT_MODEL;
  return IMPORT_MODELS.includes(model as ImportModel) ? model as ImportModel : null;
}
