import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {prepareImportFile,toContentBlocks} from '../../lib/import/files';

async function main(){
 const root=path.resolve('docs/qa/2026-10-23-ai-import');
 const results=[];
 for(const id of fs.readdirSync(path.join(root,'fixtures/supplement'))){
  const dir=path.join(root,'fixtures/supplement',id);
  const gold=JSON.parse(fs.readFileSync(path.join(dir,'expected.json'),'utf8'));
  const t=performance.now();
  const files=await Promise.all(gold.documents.map((n:string)=>prepareImportFile(n,new Uint8Array(fs.readFileSync(path.join(dir,n))),"pt-BR")));
  const text=files.filter(f=>'text' in f).map(f=>f.text).join('\n');
  if(id==='10-xlsx-30'){
   for(const p of gold.proposal.posts)assert(text.includes(p.title));
   assert(text.includes('09:30'));assert(text.includes('2026-11-01'));
   assert(text.includes('Analytics'));assert(text.includes('Legenda - não importar'));
  }
  if(id==='09-csv-120'){
   assert.equal((text.match(/^\[linha \d+\]/gm)??[]).length,121,'120 logical records plus header');
   assert(text.replace(/^\[linha \d+\] /gm,'')===fs.readFileSync(path.join(dir,'calendario-120.csv'),'utf8').replace(/\r\n/g,'\n').trim(),'CSV contents preserved after source line labels');
  }
  if(id==='07-pdf-raster')assert(toContentBlocks(files).some(b=>b.type==='document'));
  fs.writeFileSync(path.join(dir,'extracted.txt'),text);
  results.push({id,extractionMs:performance.now()-t,documentBytes:files.reduce((a,f)=>a+f.size,0),mediaFiles:gold.media.length,
   expectedPosts:gold.expectedPosts,actualAiPosts:null,created:0,ai:'NOT RUN',blocks:toContentBlocks(files).map(b=>b.type),
   note:id==='07-pdf-raster'?'PDF repassado como documento; OCR não foi executado':id==='10-xlsx-30'?'30 títulos e horários preservados; ignorar abas é tarefa semântica ainda não validada':'Extração local; semântica ainda não validada'});
 }
 fs.mkdirSync(path.join(root,'supplement'),{recursive:true});
 fs.writeFileSync(path.join(root,'supplement/extraction-results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
}
main();
