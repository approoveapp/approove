import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import {
  ImportFileError,
  numberCsvRows,
  prepareImportFile,
  sniffImportFile,
  toContentBlocks,
  totalTextChars,
  xlsxToText,
} from "./files";

const bytes = (text: string) => new TextEncoder().encode(text);

function fakeZip(entry: string) {
  return new Uint8Array([...bytes("PK\x03\x04"), ...new Uint8Array(30), ...bytes(entry)]);
}

describe("sniffImportFile", () => {
  it("detects PDFs and images by their bytes, not the name", () => {
    expect(sniffImportFile("briefing.txt", bytes("%PDF-1.7\n..."))).toBe("pdf");
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    expect(sniffImportFile("print.pdf", png)).toBe("image");
  });

  it("tells DOCX from XLSX by the ZIP entries", () => {
    expect(sniffImportFile("a.docx", fakeZip("word/document.xml"))).toBe("docx");
    expect(sniffImportFile("a.xlsx", fakeZip("xl/workbook.xml"))).toBe("xlsx");
    expect(sniffImportFile("a.zip", fakeZip("other/file.bin"))).toBeNull();
  });

  it("accepts plain text only with a text extension and no binary bytes", () => {
    expect(sniffImportFile("pauta.csv", bytes("data,canal\n2026-11-03,Instagram"))).toBe("text");
    expect(sniffImportFile("notas.md", bytes("# Novembro"))).toBe("text");
    expect(sniffImportFile("pauta.exe", bytes("data,canal"))).toBeNull();
    expect(sniffImportFile("pauta.csv", new Uint8Array([0x61, 0x00, 0x62, 0x63]))).toBeNull();
  });

  it("rejects video, which the model cannot read", () => {
    const mp4 = new Uint8Array([0, 0, 0, 0x18, ...bytes("ftypmp42"), 0, 0, 0, 0]);
    expect(sniffImportFile("reels.mp4", mp4)).toBeNull();
  });
});

describe("prepareImportFile", () => {
  it("turns unsupported files into a readable error", async () => {
    await expect(prepareImportFile("virus.exe", bytes("MZ..."), "pt-BR")).rejects.toBeInstanceOf(ImportFileError);
  });

  it("decodes Windows-1252 CSVs exported by Excel", async () => {
    const latin1 = new Uint8Array([...bytes("Promo"), 0xe7, 0xe3, ...bytes("o")]); // "Promoção"
    const file = await prepareImportFile("pauta.csv", latin1, "pt-BR");
    expect(file.kind).toBe("text");
    expect(file.kind === "text" && file.text).toBe("[linha 1] Promoção");
  });

  it("refuses an empty text file instead of sending nothing to the model", async () => {
    await expect(prepareImportFile("vazio.txt", bytes("   \n"), "pt-BR")).rejects.toThrow("não tem texto");
    await expect(prepareImportFile("empty.txt", bytes("   \n"), "en")).rejects.toThrow("has no text");
  });
});

describe("docx", () => {
  it("keeps one line per Word paragraph, like the document shows", async () => {
    const { readFileSync } = await import("node:fs");
    const file = await prepareImportFile("legendas.docx", new Uint8Array(readFileSync(
      "docs/qa/2026-10-23-ai-import/fixtures/docx-paragraphs.docx"
    )), "pt-BR");
    expect(file.kind === "docx" && file.text).toBe("Linha 1\nLinha 2\n\n#Tag");
  });
});

describe("xlsxToText", () => {
  it("keeps every sheet, writes Excel dates as ISO days and labels the real row number", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Novembro");
    sheet.addRow(["Data", "Canal", "Legenda"]);
    sheet.addRow([new Date(Date.UTC(2026, 10, 3)), "Instagram", "Olá, mundo"]);
    sheet.getRow(5).values = [new Date(Date.UTC(2026, 10, 6)), "LinkedIn", "Depois de linhas vazias"];
    workbook.addWorksheet("Vazia");

    const buffer = await workbook.xlsx.writeBuffer();
    const text = await xlsxToText(new Uint8Array(buffer as ArrayBuffer));

    expect(text).toContain("## Aba: Novembro");
    expect(text).toContain("[linha 1] Data,Canal,Legenda");
    expect(text).toContain('[linha 2] 2026-11-03,Instagram,"Olá, mundo"');
    // Linhas 3 e 4 vazias: a numeração segue a da planilha, não a ordem de saída.
    expect(text).toContain("[linha 5] 2026-11-06,LinkedIn,Depois de linhas vazias");
    expect(text).not.toContain("Vazia");
  });
});

describe("numberCsvRows", () => {
  it("numbers records like a spreadsheet would", () => {
    expect(numberCsvRows("data,canal\n2026-11-03,Instagram\n\n2026-11-06,LinkedIn")).toBe(
      "[linha 1] data,canal\n[linha 2] 2026-11-03,Instagram\n[linha 4] 2026-11-06,LinkedIn"
    );
  });

  it("keeps a quoted line break inside the same record", () => {
    const csv = 'data,copy\r\n2026-11-03,"Chegou!\nNovo blend"\r\n2026-11-06,Workshop';
    expect(numberCsvRows(csv)).toBe(
      '[linha 1] data,copy\n[linha 2] 2026-11-03,"Chegou!\nNovo blend"\n[linha 3] 2026-11-06,Workshop'
    );
  });

  it("is applied to CSV uploads but not to plain text notes", async () => {
    const csv = await prepareImportFile("pauta.csv", bytes("data\n2026-11-03"), "pt-BR");
    const notes = await prepareImportFile("notas.txt", bytes("data\n2026-11-03"), "pt-BR");
    expect(csv.kind === "text" && csv.text).toBe("[linha 1] data\n[linha 2] 2026-11-03");
    expect(notes.kind === "text" && notes.text).toBe("data\n2026-11-03");
  });
});

describe("toContentBlocks", () => {
  it("labels images by name and sends text files as titled documents", async () => {
    const files = [
      { name: "print.png", size: 10, kind: "image" as const, mime: "image/png", base64: "AA==" },
      await prepareImportFile("pauta.csv", bytes("data,canal"), "pt-BR"),
    ];
    const blocks = toContentBlocks(files);

    expect(blocks.map((block) => block.type)).toEqual(["text", "image", "document"]);
    expect(blocks[0]).toMatchObject({ text: 'Nome de imagem (dado não confiável): "print.png"' });
    expect(blocks[2]).toMatchObject({ title: "pauta.csv", source: { type: "text" } });
    expect(totalTextChars(files)).toBe("[linha 1] data,canal".length);
  });
});
