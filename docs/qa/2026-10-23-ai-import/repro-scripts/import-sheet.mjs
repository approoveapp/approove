import fs from 'node:fs/promises';
import { Workbook, SpreadsheetFile } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const dir = process.argv[2] || 'docs/qa/2026-10-23-ai-import/fixtures/02-planilha';
const supplemental = dir.includes('10-xlsx-30');
const posts = JSON.parse(await fs.readFile(`${dir}/rows.json`,'utf8'));
const wb=Workbook.create();
const half=Math.ceil(posts.length/2);
for (const [tab, rows] of [['Quinzena 1',posts.slice(0,half)],['Quinzena 2',posts.slice(half)]]) {
  const s=wb.worksheets.add(tab);
  s.getRange('A1:G1').merge(); s.getRange('A1').values=[['OFICINA AURORA • Novembro 2026 • America/Sao_Paulo • FICTÍCIO']];
  s.getRange('A2:G2').values=[['Data','Hora','Canal','Formato','Título','Legenda final','Referência (não é arte anexada)']];
  s.getRange(`A3:G${rows.length+2}`).values=rows.map((p,i)=>[supplemental&&i%5===0?p.date:(Date.parse(`${p.date}T00:00:00Z`) - Date.parse("1899-12-30T00:00:00Z"))/86400000, p.time?(Number(p.time.slice(0,2))*60+Number(p.time.slice(3)))/1440:null,p.channel,p.format,p.title,p.copyText,'https://example.com/referencia']);
  s.getRange(`A3:A${rows.length+2}`).setNumberFormat('dd/mm/yyyy');
  s.getRange(`B3:B${rows.length+2}`).setNumberFormat('hh:mm');
  s.getRange('A1:G2').format.fill='#165E57';
  s.getRange('A1:G2').format.font.color='#FFFFFF';
  s.getRange('A1:G2').format.font.bold=true;
  s.getRange('A:G').format.columnWidth=16;
  s.getRange('F:F').format.columnWidth=48;
  s.getRange('G:G').format.columnWidth=35;
  s.getRange(`A3:G${rows.length+2}`).format.rowHeight=48;
  s.getRange(`A1:G${rows.length+2}`).format.wrapText=true;
  s.getRange('A2:G2').format.rowHeight=44;
  s.showGridLines=false;
  s.freezePanes.freezeRows(2);
}
const notes=wb.worksheets.add('Analytics - não importar');
notes.getRange('A1:B3').values=[['Métricas passadas (não são publicações)','Valor'],['Alcance outubro',1200],['Cliques outubro',50]];
notes.getRange('A:A').format.columnWidth=55;
notes.showGridLines=false;
if(supplemental){
 const legend=wb.worksheets.add('Legenda - não importar');
 legend.getRange('A1:B4').values=[['Referência de preenchimento','Significado'],['Data','Novembro de 2026; fuso America/Sao_Paulo'],['Link','Referência de criação, não arquivo anexado'],['Vazio','Ainda não definido; não inventar']];
 legend.getRange('A:A').format.columnWidth=35;legend.getRange('B:B').format.columnWidth=60;legend.showGridLines=false;
}
await wb.recalculate();
await (await SpreadsheetFile.exportXlsx(wb)).save(`${dir}/novembro.xlsx`);
const preview=await wb.render({sheetName:'Quinzena 1',range:'A1:F7',scale:1,format:'png'});
await fs.writeFile(`${dir}/preview.png`,new Uint8Array(await preview.arrayBuffer()));
if(supplemental){
 for(const [sheetName,range,file] of [['Quinzena 1','A1:G17','quinzena-1'],['Quinzena 2','A1:G17','quinzena-2'],['Analytics - não importar','A1:B3','analytics'],['Legenda - não importar','A1:B4','legenda']]){
  const view=await wb.render({sheetName,range,scale:1,format:'png'});
  await fs.writeFile(`${dir}/${file}.png`,new Uint8Array(await view.arrayBuffer()));
 }
}
// ExcelJS requires the default worksheet namespace; normalize equivalent x: tags.
const { execFileSync } = await import('node:child_process');
execFileSync('python3', ['-c', `from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import io
p=Path('${dir}/novembro.xlsx'); raw=p.read_bytes()
with ZipFile(io.BytesIO(raw)) as src, ZipFile(p,'w',ZIP_DEFLATED) as dst:
 for item in src.infolist():
  data=src.read(item.filename)
  if item.filename.endswith('.xml'):
   data=data.replace(b'xmlns:x="http://schemas.openxmlformats.org/spreadsheetml/2006/main"',b'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"').replace(b'<x:',b'<').replace(b'</x:',b'</')
  dst.writestr(item,data)`]);
console.log(`Workbook exported, ${posts.length} posts; ${supplemental?'four':'three'} tabs.`);
