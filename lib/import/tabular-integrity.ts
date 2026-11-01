import type { PreparedImportFile } from "./files";
import { IMPORT_CHANNELS, type ImportProposal } from "./proposal";
import { localizedText, type AppLocale } from "@/lib/locale";

type SourceRow = { id: string; file: string; sheet: string; row: number; channel: string; literal: {title?: string; copyText?: string; date?: string; time?: string} };
/** A place whose occurrences were not counted; formatted in the requester's locale only in the warning. */
export type UnverifiedLocation = { file: string; sheet: string; row?: number };
export type TabularIndex = { rows: SourceRow[]; unverified: UnverifiedLocation[]; complete: boolean };
const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

export function fields(record: string, delimiter: string) {
  const result: string[] = [];
  let value = "", quoted = false;
  for (let i = 0; i < record.length; i++) {
    const c = record[i];
    if (c === '"') {
      if (quoted && record[i + 1] === '"') { value += '"'; i++; }
      else quoted = !quoted;
    } else if (c === delimiter && !quoted) { result.push(value); value = ""; }
    else value += c;
  }
  result.push(value);
  return result;
}

/** Labels come from our extractor, not model output. Multiline cells stay in one record. */
function records(text: string) {
  const result: { row: number; text: string }[] = [];
  let quoted = false;
  for (const line of text.split(/\r?\n/)) {
    const label = !quoted && line.match(/^\[linha (\d+)\] (.*)$/);
    if (label) result.push({ row: Number(label[1]), text: label[2] });
    else if (quoted && result.length) result[result.length - 1].text += `\n${line}`;
    if ((line.match(/"/g)?.length ?? 0) % 2) quoted = !quoted;
  }
  return result;
}

function splitSheets(text: string) {
  const sections: string[] = []; let quoted = false;
  for (const line of text.split(/\r?\n/)) {
    if (!quoted && line.startsWith("## Aba: ")) { sections.push(line.slice(8)); continue; }
    if(sections.length) sections[sections.length-1] += "\n" + line;
    if ((line.match(/"/g)?.length ?? 0) % 2) quoted = !quoted;
  }
  return sections;
}

/** Conservative coverage: only explicit channel + title/copy columns, never generic nonempty-row counts. */
export function indexTabularSources(files: PreparedImportFile[]): TabularIndex {
  const index: TabularIndex = { rows: [], unverified: [], complete: files.length > 0 && files.every(file => file.kind === "xlsx" || (file.kind === "text" && /\.(csv|tsv)$/i.test(file.name))) };
  files.forEach((file, fileIndex) => {
    if (file.kind !== "xlsx" && !(file.kind === "text" && /\.(csv|tsv)$/i.test(file.name))) return;
    if (!("text" in file)) return;
    const sections = file.kind === "xlsx"
      ? splitSheets(file.text).map(section => {
          const newline = section.indexOf("\n");
          return { sheet: section.slice(0, newline), text: section.slice(newline + 1) };
        })
      : [{ sheet: "", text: file.text }];
    sections.forEach(({ sheet, text }, sheetIndex) => {
      const rows = records(text);
      let channelCol = -1, contentCols: number[] = [], delimiter = ",", header = -1, headerNames: string[] = [];
      for (let i = 0; i < Math.min(rows.length, 10); i++) {
        for (const sep of [",", ";", "\t"]) {
          const names = fields(rows[i].text, sep).map(normalize);
          const ch = names.findIndex(n => ["canal", "channel", "rede", "rede social", "plataforma"].includes(n));
          const contents = names.flatMap((n, j) => ["titulo", "title", "tema", "legenda", "copy", "copytext", "caption"].includes(n) ? [j] : []);
          if (ch >= 0 && contents.length) { headerNames = names; channelCol = ch; contentCols = contents; delimiter = sep; header = i; break; }
        }
        if (header >= 0) break;
      }
      const location = `${file.name}${sheet ? `, aba ${sheet}` : ""}`;
      if (header < 0) { index.unverified.push({ file: file.name, sheet }); return; }
      for (const row of rows.slice(header + 1)) {
        const cells = fields(row.text, delimiter);
        if (!contentCols.some(col => cells[col]?.trim())) continue;
        // Refuse ragged rows: guessing whether an extra cell is caption corrupts literal copy.
        if (cells.length > headerNames.length && cells.slice(headerNames.length).some(v => v.trim())) {
          throw new Error(`Tabela ambígua em ${location}, linha ${row.row}: há valores sem cabeçalho. Nomeie as colunas ou exporte uma tabela regular antes de importar.`);
        }
        const channel = IMPORT_CHANNELS.find(c => normalize(c) === normalize(cells[channelCol] ?? ""));
        if (!channel) { index.unverified.push({ file: file.name, sheet, row: row.row }); continue; }
        const literal: SourceRow["literal"] = {};
        for (const [key, names] of Object.entries({title:["titulo","title"],copyText:["legenda","copy","copytext","caption"],date:["data","date"],time:["hora","horario","time"]})) {
          const columns = headerNames.flatMap((name, i) => names.includes(name) ? [i] : []);
          if(columns.length === 1) {
            const value = cells[columns[0]] ?? "";
            if(key === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) continue;
            if(key === "time" && !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) continue;
            literal[key as keyof typeof literal] = value;
          }
        }
        index.rows.push({ literal, id: `T${fileIndex + 1}A${sheetIndex + 1}L${row.row}`, file: file.name, sheet, row: row.row, channel });
      }
    });
  });
  index.complete = index.complete && index.rows.length > 0 && index.unverified.length === 0;
  return index;
}

export function tabularSourceInstructions(index: TabularIndex) {
  if (!index.rows.length) return "";
  return `Conferência de ocorrências da fonte (extraída das tabelas, não é gabarito):\nCada ocorrência abaixo deve gerar seu próprio item, mesmo quando o conteúdo é idêntico. Em sourceRef, use o identificador da ocorrência; em source, cite o arquivo/aba/linha. Não combine linhas. Não use um identificador em outro item.\n${index.rows.map(r => `${r.id}: ${JSON.stringify({arquivo:r.file,aba:r.sheet,linha:r.row,canal:r.channel,camposLiterais:r.literal})}`).join("\n")}`;
}

/**
 * Reject partial/combined/repeated coverage before a job can reach review or commit.
 * `sourceRefs[i]` is the structured row id of post i; without it, `[origem:ID]` in source counts.
 */
export function tabularIntegrityError(index: TabularIndex, proposal: ImportProposal, locale: AppLocale, sourceRefs: readonly (string | null)[] = []): string | null {
  if (!index.rows.length) return null;
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const seen = new Map<string, number>();
  const expected = new Map(index.rows.map(row => [row.id, row]));
  let invalid = 0;
  for (const [i, post] of proposal.posts.entries()) {
    const ref = sourceRefs[i];
    const ids = ref ? [ref] : [...post.source.matchAll(/\[origem:([^\]]+)\]/g)].map(m => m[1]);
    if (ids.length > 1 || (index.complete && ids.length === 0)) invalid++;
    for (const id of ids) {
      const row = expected.get(id);
      if (!row || row.channel !== post.channel) invalid++;
      if (row && Object.entries(row.literal).some(([field,value]) => post[field as keyof typeof row.literal] !== value)) {
        return tr(
          `A resposta alterou campos literais da tabela em ${row.file}, linha ${row.row}. Nenhuma publicação foi criada. Revise a fonte antes de tentar novamente.`,
          `The response changed literal table fields in ${row.file}, row ${row.row}. No posts were created. Review the source before trying again.`
        );
      }
      seen.set(id, (seen.get(id) ?? 0) + 1);
    }
  }
  const missing = index.rows.filter(row => !seen.has(row.id));
  const repeated = index.rows.filter(row => (seen.get(row.id) ?? 0) > 1);
  if (!missing.length && !repeated.length && !invalid) return null;
  const locations = missing.slice(0, 5).map(row => `${row.file}${row.sheet ? ` (${row.sheet})` : ""}, ${tr("linha", "row")} ${row.row}`).join("; ");
  return tr(
    `A resposta da IA não preservou todas as ocorrências identificadas nas tabelas: ${index.rows.length} esperadas, ${missing.length} ausentes, ${repeated.length} repetidas e ${invalid} referências inválidas.${locations ? ` Confira: ${locations}.` : ""} Nenhuma publicação foi criada. Revise os arquivos e tente novamente; uma nova tentativa pode consumir a cota.`,
    `The AI response did not preserve every occurrence found in the tables: ${index.rows.length} expected, ${missing.length} missing, ${repeated.length} repeated and ${invalid} invalid references.${locations ? ` Check: ${locations}.` : ""} No posts were created. Review the files and try again; a new attempt may use quota.`
  );
}

export function tabularCoverageWarning(index: TabularIndex, locale: AppLocale) {
  if (!index.unverified.length) return null;
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const places = index.unverified.slice(0, 5)
    .map(({ file, sheet, row }) => `${file}${sheet ? `, ${tr("aba", "sheet")} ${sheet}` : ""}${row !== undefined ? `, ${tr("linha", "row")} ${row}` : ""}`)
    .join("; ");
  const more = index.unverified.length - 5;
  return tr(
    `A contagem não foi conferida automaticamente em: ${places}${more > 0 ? ` e mais ${more} locais` : ""}. Podem ser abas auxiliares ou tabelas sem cabeçalhos/canais reconhecidos. Compare com a fonte antes de confirmar.`,
    `The count was not checked automatically in: ${places}${more > 0 ? ` and ${more} more places` : ""}. These may be helper sheets or tables without recognized headers/channels. Compare with the source before confirming.`
  );
}
