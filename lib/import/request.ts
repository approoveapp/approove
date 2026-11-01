import { ApiError } from "@/lib/api-error";
import { DEFAULT_LOCALE, localizedText, type AppLocale } from "@/lib/locale";

/** Enforce actual streamed bytes, including requests without Content-Length. */
export async function boundedImportBody(request: Request, maxBytes: number, timeoutMs = 15000, locale: AppLocale = DEFAULT_LOCALE) {
  const tooLarge = () => new ApiError(413, localizedText(locale, "Arquivos grandes demais para esta importação.", "Files are too large for this import."));
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > maxBytes) throw tooLarge();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  let timedOut = false;
  const timer = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, timeoutMs);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) throw new ApiError(408, localizedText(locale, "Tempo de envio excedido.", "Upload timed out."));
      if (done) break;
      size += value.length;
      if (size > maxBytes) {
        void reader.cancel().catch(() => undefined);
        throw tooLarge();
      }
      chunks.push(value);
    }
  } finally { clearTimeout(timer); reader.releaseLock(); }
  const result = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { result.set(chunk, offset); offset += chunk.length; }
  return result;
}
export async function boundedImportFormData(request: Request, maxBytes: number, locale: AppLocale = DEFAULT_LOCALE) {
  const bytes = await boundedImportBody(request, maxBytes, undefined, locale);
  try { return await new Response(bytes, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { throw new ApiError(400, localizedText(locale, "Formulário de upload inválido.", "Invalid upload form.")); }
}
