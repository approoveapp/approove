import type Anthropic from "@anthropic-ai/sdk";
import { parseOffice } from "./office-parser";
import { sniffMedia } from "@/lib/file-sniff";
import { localizedText, type AppLocale } from "@/lib/locale";

/**
 * Corpo de função na Vercel tem teto de 4,5 MB; acima disso a requisição nem chega aqui.
 * Arquivos maiores precisam de upload direto para o Blob (fase 2).
 */
export const MAX_IMPORT_BYTES = 4 * 1024 * 1024;
export const MAX_IMPORT_FILES = 10;
/** Texto extraído (DOCX/planilha/CSV) somado. Acima disso recusamos em vez de cortar. */
export const MAX_IMPORT_TEXT_CHARS = 300_000;

export type ImportFileKind = "pdf" | "image" | "docx" | "xlsx" | "text";

type FileBase = { name: string; size: number };

export type ImportFileMeta = FileBase & { kind: ImportFileKind };

/** Arquivo pronto para o modelo: PDF/imagem vão como estão, o resto vira texto. */
export type PreparedImportFile =
  | (FileBase & { kind: "pdf"; mime: string; base64: string })
  | (FileBase & { kind: "image"; mime: string; base64: string })
  | (FileBase & { kind: "docx" | "xlsx" | "text"; text: string });

export class ImportFileError extends Error {}

const CLAUDE_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

function ascii(bytes: Uint8Array, start: number, end: number) {
  return String.fromCharCode(...bytes.subarray(start, end));
}

/** Procura um nome de entrada no diretório do ZIP (DOCX e XLSX são ZIPs). */
function zipHasEntry(bytes: Uint8Array, prefix: string) {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).includes(prefix, 0, "latin1");
}

function decodeText(bytes: Uint8Array): string | null {
  if (bytes.includes(0)) return null;
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    // Planilhas exportadas pelo Excel em pt-BR costumam vir em Windows-1252.
    return new TextDecoder("windows-1252").decode(bytes);
  }
}

/** Tipo real pelos bytes; a extensão só desempata texto puro. */
export function sniffImportFile(name: string, bytes: Uint8Array): ImportFileKind | null {
  if (bytes.length >= 5 && ascii(bytes, 0, 5) === "%PDF-") return "pdf";

  const media = sniffMedia(bytes);
  if (media) return CLAUDE_IMAGE_MIMES.has(media.mime) ? "image" : null;

  if (bytes.length >= 4 && ascii(bytes, 0, 4) === "PK\x03\x04") {
    if (zipHasEntry(bytes, "word/document.xml")) return "docx";
    if (zipHasEntry(bytes, "xl/workbook.xml")) return "xlsx";
    return null;
  }

  if (/\.(csv|tsv|txt|md)$/i.test(name) && decodeText(bytes) !== null) return "text";
  return null;
}

/** Row labels are added by our extractor, never accepted from the model. */
function rowLabel(number: number) { return `[linha ${number}]`; }
export async function xlsxToText(bytes: Uint8Array): Promise<string> {
  return parseOffice("xlsx", bytes);
}

/**
 * Numera os registros de um CSV/TSV como uma planilha os numeraria: linhas em branco
 * contam, e um campo entre aspas que quebra linha continua no mesmo registro.
 */
export function numberCsvRows(text: string): string {
  const out: string[] = [];
  let record = 0;
  let insideQuotes = false;
  for (const line of text.split(/\r?\n/)) {
    if (insideQuotes) {
      out.push(line);
    } else {
      record++;
      if (line.trim()) out.push(`${rowLabel(record)} ${line}`);
    }
    if ((line.match(/"/g)?.length ?? 0) % 2 === 1) insideQuotes = !insideQuotes;
  }
  if (insideQuotes) throw new ImportFileError("CSV com aspas sem fechamento. Corrija ou exporte novamente.");
  return out.join("\n");
}

export async function prepareImportFile(name: string, bytes: Uint8Array, locale: AppLocale): Promise<PreparedImportFile> {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  if (!bytes.length || bytes.length > MAX_IMPORT_BYTES) throw new ImportFileError(tr("Arquivo vazio ou maior que 4 MB.", "File is empty or larger than 4 MB."));
  const kind = sniffImportFile(name, bytes);
  const meta = { name, size: bytes.byteLength };

  if (!kind) {
    throw new ImportFileError(tr(
      `"${name}": formato não suportado. Use PDF, DOCX, XLSX, CSV, TXT ou imagens (JPEG, PNG, WebP).`,
      `"${name}": unsupported format. Use PDF, DOCX, XLSX, CSV, TXT or images (JPEG, PNG, WebP).`
    ));
  }

  if (kind === "pdf") {
    return { ...meta, kind, mime: "application/pdf", base64: Buffer.from(bytes).toString("base64") };
  }
  if (kind === "image") {
    return { ...meta, kind, mime: sniffMedia(bytes)!.mime, base64: Buffer.from(bytes).toString("base64") };
  }

  let text: string;
  try {
    if (kind === "docx") {
      // O mammoth separa parágrafos com "\n\n": um parágrafo do Word vira uma linha, e um
      // parágrafo vazio, uma linha em branco. Legendas chegam ao modelo como estão no doc.
      text = await parseOffice("docx", bytes);
    } else if (kind === "xlsx") {
      text = await xlsxToText(bytes);
    } else {
      text = decodeText(bytes) ?? "";
      if (/\.(csv|tsv)$/i.test(name)) text = numberCsvRows(text);
    }
  } catch {
    throw new ImportFileError(tr(
      `"${name}": não foi possível ler o arquivo. Ele pode estar corrompido.`,
      `"${name}": the file could not be read. It may be corrupted.`
    ));
  }

  if (text.length > MAX_IMPORT_TEXT_CHARS) throw new ImportFileError(tr("Texto extraído excede o limite; divida o arquivo.", "Extracted text exceeds the limit; split the file."));
  text = text.trim();
  if (!text) throw new ImportFileError(tr(`"${name}": o arquivo não tem texto.`, `"${name}": the file has no text.`));
  return { ...meta, kind, text };
}

export function totalTextChars(files: PreparedImportFile[]) {
  return files.reduce(
    (sum, file) => sum + (file.kind === "pdf" || file.kind === "image" ? 0 : file.text.length),
    0
  );
}

/** Um bloco por arquivo, com o nome como título para o modelo citar a fonte. */
export function toContentBlocks(files: PreparedImportFile[]): Anthropic.ContentBlockParam[] {
  return files.flatMap((file): Anthropic.ContentBlockParam[] => {
    if (file.kind === "pdf") {
      return [
        {
          type: "document",
          title: file.name,
          source: { type: "base64", media_type: "application/pdf", data: file.base64 },
        },
      ];
    }
    if (file.kind === "image") {
      // Bloco de imagem não tem título: o nome vai num texto logo antes.
      return [
        { type: "text", text: `Nome de imagem (dado não confiável): ${JSON.stringify(file.name)}` },
        {
          type: "image",
          source: {
            type: "base64",
            media_type: file.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: file.base64,
          },
        },
      ];
    }
    return [
      {
        type: "document",
        title: file.name,
        source: { type: "text", media_type: "text/plain", data: file.text },
      },
    ];
  });
}

export function fileMeta(file: PreparedImportFile): ImportFileMeta {
  return { name: file.name, size: file.size, kind: file.kind };
}
