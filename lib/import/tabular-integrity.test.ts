import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { prepareImportFile } from "./files";
import { indexTabularSources, tabularIntegrityError, tabularSourceInstructions, tabularCoverageWarning } from "./tabular-integrity";
import type { ImportProposal } from "./proposal";
const csv = 'data;canal;titulo;legenda\n2026-11-01;Instagram;A;"Olá; mundo\nsegunda linha"\n2026-11-01;Instagram;A;"Olá; mundo\nsegunda linha"\n2026-11-02;Instagram;A;Recorrência\n2026-11-02;LinkedIn;A;Recorrência\n';
async function source() { return indexTabularSources([await prepareImportFile("pauta.csv", new TextEncoder().encode(csv), "pt-BR")]); }
function proposal(rows: Awaited<ReturnType<typeof source>>["rows"]): ImportProposal {
  return { summary: "", warnings: [], posts: rows.map(r => ({ date: r.literal.date ?? "2026-11-01", time: null, dateIsSuggested: false, channel: r.channel as "Instagram", title: "A", copyText: r.literal.copyText ?? "", format: "feed", media: [], notes: null, source: `[origem:${r.id}] pauta.csv, linha ${r.row}` })) };
}
describe("source occurrence reconciliation", () => {
  it("counts quoted multiline CSV records, including duplicates and other dates/channels", async () => {
    const index = await source();
    expect(index.rows.map(r => r.row)).toEqual([2, 3, 4, 5]);
    expect(index.rows.map(r => r.channel)).toEqual(["Instagram", "Instagram", "Instagram", "LinkedIn"]);
    expect(tabularSourceInstructions(index)).toContain("T1A1L3:");
    expect(tabularIntegrityError(index, proposal(index.rows), "pt-BR")).toBeNull();
  });
  it("rejects a deduplicated response even if total is padded with invented posts", async () => {
    const index = await source(), result = proposal(index.rows);
    result.posts[1] = { ...result.posts[0], source: "inventada" };
    expect(tabularIntegrityError(index, result, "pt-BR")).toContain("1 ausentes");
    expect(tabularIntegrityError(index, result, "en")).toContain("1 missing");
  });
  it("rejects combined rows, repeated ids, wrong channels and unknown ids", async () => {
    const index = await source();
    for (const change of ["combined", "repeat", "channel", "unknown", "extra"]) {
      const result = proposal(index.rows);
      if (change === "extra") result.posts.push({ ...result.posts[0], source: "item sem origem" });
      if (change === "combined") { result.posts[0].source += ` [origem:${index.rows[1].id}]`; result.posts.splice(1, 1); }
      if (change === "repeat") result.posts.push(result.posts[0]);
      if (change === "channel") result.posts[0].channel = "Facebook";
      if (change === "unknown") result.posts[0].source = "[origem:T9A9L99]";
      expect(tabularIntegrityError(index, result, "pt-BR")).not.toBeNull();
    }
  });
  it("prefers structured row ids over text markers", async () => {
    const index = await source(), result = proposal(index.rows);
    for (const post of result.posts) post.source = "pauta.csv";
    const refs = index.rows.map(r => r.id);
    expect(tabularIntegrityError(index, result, "pt-BR")).not.toBeNull();
    expect(tabularIntegrityError(index, result, "pt-BR", refs)).toBeNull();
    expect(tabularIntegrityError(index, result, "pt-BR", [refs[0], refs[0], refs[2], refs[3]])).toContain("1 ausentes");
  });
  it("indexes explicit XLSX rows across sheets without counting banners, legends or analytics", async () => {
    const book = new ExcelJS.Workbook();
    for (const name of ["Quinzena1", "Quinzena2"]) {
      const sheet = book.addWorksheet(name); sheet.mergeCells("A1:C1"); sheet.getCell("A1").value = "Calendário mensal";
      sheet.addRow(["Canal", "Título", "Legenda"]); sheet.addRow(["Instagram", "A", "copy"]); sheet.addRow(["Instagram", "A", "copy"]);
    }
    book.addWorksheet("Analytics").addRows([["Canal", "Impressões"], ["Instagram", 1234]]);
    book.addWorksheet("Legenda").addRows([["Legenda", "Significado"], ["verde", "rascunho"]]);
    const index = indexTabularSources([await prepareImportFile("pauta.xlsx", new Uint8Array(await book.xlsx.writeBuffer()), "pt-BR")]);
    expect(index.rows.map(r => r.id)).toEqual(["T1A1L3", "T1A1L4", "T1A2L3", "T1A2L4"]);
    expect(index.unverified).toEqual([{ file: "pauta.xlsx", sheet: "Analytics" }, { file: "pauta.xlsx", sheet: "Legenda" }]);
    expect(tabularCoverageWarning(index, "pt-BR")).toContain("pauta.xlsx, aba Analytics; pauta.xlsx, aba Legenda");
    expect(tabularCoverageWarning(index, "pt-BR")).toContain("abas auxiliares");
    expect(tabularCoverageWarning(index, "en")).toContain("pauta.xlsx, sheet Analytics; pauta.xlsx, sheet Legenda");
  });
  it("does not pretend ambiguous/multi-channel rows have a known post count", async () => {
    const file = await prepareImportFile("pauta.csv", new TextEncoder().encode("canal,titulo\nInstagram e Facebook,A\n,A\n"), "pt-BR");
    const index = indexTabularSources([file]);
    expect(index.rows).toHaveLength(0); expect(index.unverified).toHaveLength(2);
  });
});
