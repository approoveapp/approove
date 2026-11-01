import { del, list, put, get } from "@vercel/blob";
import { mkdir, readdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { privateImportPath, privateImportUrl } from "./import/private-media-url";
import { boundedImportBody } from "./import/request";

/** Legacy prefix retained only for old fixture compatibility; new uploads never use it. */
export const DEV_UPLOADS_PREFIX = "/dev-uploads/";

const DEV_UPLOADS_DIR = path.join(process.cwd(), ".import-media");

export function isMediaStorageConfigured() {
  return Boolean(process.env.IMPORT_BLOB_READ_WRITE_TOKEN) || process.env.NODE_ENV !== "production";
}

/**
 * Grava a mídia e devolve a URL autenticada. Com IMPORT_BLOB_READ_WRITE_TOKEN vai para o Vercel Blob;
 * sem ele, em dev/teste, vai para .import-media, fora da pasta pública, para testar o fluxo
 * sem escrever no Blob de produção.
 */
export async function storeMedia(pathname: string, bytes: Uint8Array, contentType: string) {
  if (!privateImportPath(privateImportUrl(pathname))) throw new Error("Invalid import path");
  const token = process.env.IMPORT_BLOB_READ_WRITE_TOKEN;
  if (token) {
    await put(pathname, Buffer.from(bytes), { access: "private", contentType, token, addRandomSuffix: false, abortSignal: AbortSignal.timeout(15000) });
    return privateImportUrl(pathname);
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("IMPORT_BLOB_READ_WRITE_TOKEN não configurado");
  }
  const file = path.join(DEV_UPLOADS_DIR, pathname);
  if (!file.startsWith(DEV_UPLOADS_DIR + path.sep)) throw new Error("Caminho inválido");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, bytes);
  return privateImportUrl(pathname);
}

/** Reads admitted private media by fixed storage path, never an arbitrary external URL. */
export async function readDevMedia(url: string): Promise<Buffer | null> {
  const pathname=privateImportPath(url);
  if(!pathname)return null;
  const token=process.env.IMPORT_BLOB_READ_WRITE_TOKEN;
  if(token) {
    const blob=await get(pathname,{access:"private",token,abortSignal:AbortSignal.timeout(15000)});
    if(!blob || blob.statusCode!==200 || blob.blob.size>4*1024*1024)return null;
    return Buffer.from(await boundedImportBody(new Response(blob.stream) as unknown as Request,4*1024*1024));
  }
  if(process.env.NODE_ENV==="production")return null;
  const file=path.join(DEV_UPLOADS_DIR,pathname);
  const info=await stat(file).catch(()=>null);
  if(!info || info.size>4*1024*1024)return null;
  return readFile(file);
}

export type StoredMedia = { url: string; uploadedAt: Date };

/** Caminho das mídias de importação: uploads/<organização>/import-... */
const IMPORT_MEDIA_PATH = /^uploads\/[^/]+\/import-[^/]+$/;

/** Todas as mídias de importação no storage, de todas as organizações. */
export async function listImportMedia(): Promise<StoredMedia[]> {
  const token = process.env.IMPORT_BLOB_READ_WRITE_TOKEN;
  if (token) {
    const found: StoredMedia[] = [];
    let cursor: string | undefined;
    do {
      const page = await list({ prefix: "uploads/", cursor, token, limit: 1000 });
      for (const blob of page.blobs) {
        if (IMPORT_MEDIA_PATH.test(blob.pathname)) found.push({ url: privateImportUrl(blob.pathname), uploadedAt: blob.uploadedAt });
      }
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found;
  }
  if (process.env.NODE_ENV === "production") return [];

  const root = path.join(DEV_UPLOADS_DIR, "uploads");
  const orgs = await readdir(root).catch(() => [] as string[]);
  const found: StoredMedia[] = [];
  for (const org of orgs) {
    for (const name of await readdir(path.join(root, org)).catch(() => [] as string[])) {
      const pathname = `uploads/${org}/${name}`;
      if (!IMPORT_MEDIA_PATH.test(pathname)) continue;
      const info = await stat(path.join(DEV_UPLOADS_DIR, pathname));
      found.push({ url: privateImportUrl(pathname), uploadedAt: info.mtime });
    }
  }
  return found;
}

/** Apaga mídias do storage. URL que não é nossa é ignorada. */
export async function deleteMedia(urls: string[]) {
  if (urls.length === 0) return;
  const token = process.env.IMPORT_BLOB_READ_WRITE_TOKEN;
  const paths=urls.map(privateImportPath).filter((p):p is string=>p!==null);
  if(token) {
    for(let i=0;i<paths.length;i+=100) await del(paths.slice(i,i+100),{token});
  } else if(process.env.NODE_ENV!=="production") {
    for(const pathname of paths) await unlink(path.join(DEV_UPLOADS_DIR,pathname)).catch(()=>undefined);
  }
}
