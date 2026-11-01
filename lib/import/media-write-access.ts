import { ApiError } from "../api-error";
import { privateImportPath } from "./private-media-url";

/** Called after loading the destination under the authenticated organization. */
export function assertImportMediaOrganization(urls: string[], organizationId: string) {
  for (const url of urls) {
    const pathname = privateImportPath(url);
    if (pathname && pathname.split("/")[1] !== organizationId) {
      throw new ApiError(404, "Mídia não encontrada");
    }
  }
}
