import { Worker } from "node:worker_threads";
import { createRequire } from "node:module";
import path from "node:path";
import { validateOfficeArchive } from "./archive";
// Static external imports make Next trace both parsers and their transitive dependencies.
// Submitted data is parsed only inside the bounded worker below.
import "exceljs";
import "mammoth";

// No submitted code is evaluated. Only this fixed parser program runs in the worker.
const program = String.raw`
const { parentPort, workerData: d } = require('node:worker_threads');
const fail = () => { throw Error('Limite de leitura excedido'); };
(async () => {
 let text = '';
 if (d.kind === 'docx') {
  text = (await require(d.parser).extractRawText({buffer:Buffer.from(d.bytes)})).value.replace(/\n\n/g,'\n');
 } else {
  const book = new (require(d.parser).Workbook)();
  await book.xlsx.load(Buffer.from(d.bytes));
  if(book.worksheets.length > 32) fail();
  let rowsTotal=0, chars=0;
  const sheets=[];
  const csv=v => /[",\r\n]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
  book.eachSheet(sheet => {
   if(sheet.rowCount>5000 || sheet.columnCount>64 || /[\r\n]/.test(sheet.name)) fail();
   const rows=[];
   sheet.eachRow({includeEmpty:false},row => {
    if(++rowsTotal>5000 || row.cellCount>64) fail();
    const cells=[];
    for(let c=1;c<=row.cellCount;c++) {
     const cell=row.getCell(c); let value='';
     if(!cell.isMerged || cell.master.address===cell.address) {
      if(cell.value && typeof cell.value==='object' && ('formula' in cell.value || 'sharedFormula' in cell.value)) throw Error('Fórmulas exigem exportação para valores antes da importação');
      if(cell.value instanceof Date) {
       const iso=cell.value.toISOString(), fmt=(cell.numFmt||'').replace(/"[^"]*"|\[[^\]]*\]/g,'');
       const t=/[hs]/i.test(fmt), date=/[dy]/i.test(fmt);
       value=t&&!date?iso.slice(11,19).replace(/:00$/,''):t?iso.slice(0,19).replace('T',' '):iso.slice(0,10);
      } else value=cell.text||'';
     }
     if(value.length>10000) fail();
     cells.push(csv(value));
    }
    const line='[linha '+row.number+'] '+cells.join(','); chars+=line.length;
    if(chars>300000) fail();
    if(cells.some(Boolean))rows.push(line);
   });
   if(rows.length)sheets.push('## Aba: '+sheet.name+'\n'+rows.join('\n'));
  });
  text=sheets.join('\n\n');
 }
 if(text.length>300000) fail();
 parentPort.postMessage({text});
})().catch(()=>parentPort.postMessage({error:'Não foi possível ler dentro dos limites. Exporte fórmulas para valores ou divida o documento.'}));
`;

/** Bounded ZIP preflight, independent wall clock and per-worker V8 heap ceiling. */
export async function parseOffice(kind: "docx" | "xlsx", bytes: Uint8Array, timeoutMs = 8000): Promise<string> {
  validateOfficeArchive(bytes);
  const require = createRequire(path.join(process.cwd(), "package.json"));
  return new Promise((resolve, reject) => {
    const worker = new Worker(program, { eval: true,
      workerData: { kind, bytes, parser: require.resolve(kind === "xlsx" ? "exceljs" : "mammoth") },
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Tempo de leitura excedido. Divida o documento.")); }, timeoutMs);
    worker.once("message", result => { clearTimeout(timer); void worker.terminate(); if (result.error) reject(new Error(result.error)); else resolve(result.text); });
    worker.once("error", () => { clearTimeout(timer); reject(new Error("Leitura interrompida pelo limite de recursos.")); });
    worker.once("exit", code => { clearTimeout(timer); if (code !== 0) reject(new Error("Leitura interrompida.")); });
  });
}
