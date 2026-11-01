import { describe,it,expect } from 'vitest';
import ExcelJS from 'exceljs';
import { xlsxToText,prepareImportFile } from './files';
import { readFileSync } from 'node:fs';
describe('spreadsheet fidelity',()=>{
  it('does not repeat merged headings or trim a literal caption',async()=>{
    const w=new ExcelJS.Workbook(); const s=w.addWorksheet('Pauta');
    s.mergeCells('A1:C1');s.getCell('A1').value='Cabeçalho';
    s.getCell('A2').value='  Legenda\n#Tag  ';
    const text=await xlsxToText(new Uint8Array(await w.xlsx.writeBuffer()));
    expect(text.match(/Cabeçalho/g)).toHaveLength(1);
    expect(text).toContain('"  Legenda\n#Tag  "');
  });
  it('preserves Excel time-only and date-time cells',async()=>{
    const w=new ExcelJS.Workbook();const s=w.addWorksheet('Pauta');
    s.addRow(['Data','Hora','Data e hora']);
    s.addRow([new Date('2026-11-01T00:00:00Z'),(9*60+30)/1440,new Date('2026-11-01T18:45:00Z')]);
    s.getCell('A2').numFmt='dd/mm/yyyy';s.getCell('B2').numFmt='hh:mm';s.getCell('C2').numFmt='dd/mm/yyyy hh:mm';
    const text=await xlsxToText(new Uint8Array(await w.xlsx.writeBuffer()));
    expect(text).toContain('[linha 2] 2026-11-01,09:30,2026-11-01 18:45:00');
  });
  it('extracts actual DOCX fixture without a macOS helper',async()=>{
    const result=await prepareImportFile('briefing.docx',new Uint8Array(readFileSync('docs/qa/2026-10-23-ai-import/fixtures/05-misto/briefing.docx')), "pt-BR");
    expect(result.kind==='docx'&&result.text).toContain('Legenda 01.\nConheça a Oficina Aurora. #Aurora');
  });
});
