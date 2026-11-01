export const PRIVATE_IMPORT_PREFIX = "/api/import-media/";
export function privateImportPath(url: string): string | null {
  const match = /^\/api\/import-media\/([A-Za-z0-9_-]+)\/(import-[A-Za-z0-9_-]+\.(?:png|jpg|gif|webp|mp4|mov))$/.exec(url);
  return match ? `uploads/${match[1]}/${match[2]}` : null;
}
export function privateImportUrl(pathname: string) {
  const url = PRIVATE_IMPORT_PREFIX + pathname.replace(/^uploads\//, "");
  if (!privateImportPath(url)) throw new Error("Invalid import media path");
  return url;
}

/** Only our protected media URLs receive an existing calendar's access token. */
export function withImportMediaAccess<T>(value: T, token: string | undefined): T {
  if (!token) return value;
  if (typeof value === "string" && privateImportPath(value)) return `${value}?t=${encodeURIComponent(token)}` as T;
  if (Array.isArray(value)) return value.map(v => withImportMediaAccess(v, token)) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,withImportMediaAccess(v, token)])) as T;
  }
  return value;
}
