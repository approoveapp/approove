/** Release/rollback gate. Production requires deliberate enablement after staging checks. */
export function importFeatureEnabled() {
  return process.env.IMPORT_AI_ENABLED !== "0" && (process.env.NODE_ENV !== "production" || process.env.IMPORT_AI_ENABLED === "1");
}
