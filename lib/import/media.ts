import { randomToken } from "@/lib/crypto-tokens";
import { privateImportPath } from "./private-media-url";

/** Caminho no storage de uma mídia de importação: sempre sob a pasta da organização. */
export function importMediaPathname(organizationId: string, ext: string) {
  return `uploads/${organizationId}/import-${Date.now()}-${randomToken(9)}.${ext}`;
}

/**
 * A URL veio do nosso upload de importação, para esta organização? O job só aceita
 * essas: um link qualquer colado no corpo não vira material de post.
 */
export function isOwnImportMediaUrl(url: string, organizationId: string) {
  const pathname=privateImportPath(url);
  return !!pathname && pathname.startsWith(`uploads/${organizationId}/import-`);
}
