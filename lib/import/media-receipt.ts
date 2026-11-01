import { createHmac } from "node:crypto";
import { safeEqual } from "@/lib/crypto-tokens";
import type { ImportMedia } from "./proposal";
import { isOwnImportMediaUrl } from "./media";

const RECEIPT_LIFETIME_MS = 24 * 60 * 60 * 1000;
function secret() { return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET; }
export function canSignImportMedia() { return !!secret(); }
function signature(media: ImportMedia, org: string, client: string, expires: number) {
  const key = secret();
  if (!key) throw new Error("Import media signing unavailable");
  return createHmac("sha256", key).update(JSON.stringify(["approove-import-media-v1", org, client, media.name, media.url, media.mediaType, media.mime, media.size ?? 0, expires])).digest("base64url");
}
export function signImportMedia(media: ImportMedia, org: string, client: string, now = Date.now()) {
  const expires = now + RECEIPT_LIFETIME_MS;
  return `${expires}.${signature(media, org, client, expires)}`;
}
/** At commit, the receipt was already admitted before expiry and persisted in this job. */
export function verifyImportMedia(media: ImportMedia, org: string, client: string, options: { now?: number; admitted?: boolean } = {}) {
  if (!secret() || !isOwnImportMediaUrl(media.url, org)) return false;
  const parts = /^(\d{13})\.([A-Za-z0-9_-]{43})$/.exec(media.receipt ?? "");
  if (!parts) return false;
  const expires = Number(parts[1]);
  if (!options.admitted && expires <= (options.now ?? Date.now())) return false;
  return safeEqual(parts[2], signature(media, org, client, expires));
}
