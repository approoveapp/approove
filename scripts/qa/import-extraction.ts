import fs from 'node:fs';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { prepareImportFile, totalTextChars, MAX_IMPORT_BYTES, MAX_IMPORT_TEXT_CHARS } from '../../lib/import/files';
import { importProposalSchema, importCommitSchema } from '../../lib/import/proposal';
import { importDateTimeToIso } from '../../lib/import/review';
async function main(){
 const root=path.resolve('docs/qa/2026-10-23-ai-import'); const rows=[];
 for(const name of fs.readdirSync(path.join(root,'fixtures')).filter(n=>/^0[1-6]-/.test(n))){
  const dir=path.join(root,'fixtures',name), gold=JSON.parse(fs.readFileSync(path.join(dir,'expected.json'),'utf8'));
  const rss=process.memoryUsage().rss;const t=performance.now();
  const files=await Promise.all(gold.documents.map((n:string)=>prepareImportFile(n,new Uint8Array(fs.readFileSync(path.join(dir,n))),"pt-BR")));
  const ms=performance.now()-t;
  const text=files.filter(f=>'text' in f).map(f=>f.text).join('\n');
  fs.writeFileSync(path.join(dir,'extracted.txt'),text);
  const commit=gold.proposal.posts.map((p:ReturnType<typeof importProposalSchema.parse>["posts"][number])=>({scheduledAt:importDateTimeToIso(`${p.date}T${p.time||'10:00'}`,gold.timezone),channel:p.channel,format:p.format,title:p.title,copyText:p.copyText,media:p.media}));
  rows.push({case:name,documents:files.length,media:gold.media.length,posts:gold.expectedPosts,documentBytes:files.reduce((s,f)=>s+f.size,0),textChars:totalTextChars(files),extractionMs:ms,rssDeltaBytes:process.memoryUsage().rss-rss,rssBytes:process.memoryUsage().rss,expectedCommitValid:importCommitSchema.safeParse({posts:commit}).success,excelTimePreserved:name==='02-planilha'?text.includes('09:30'):null});
 }
 const limits={byteLimit:MAX_IMPORT_BYTES,textLimit:MAX_IMPORT_TEXT_CHARS,posts201Accepted:importCommitSchema.safeParse({posts:Array(201).fill({scheduledAt:'2026-11-01T12:30:00Z',channel:'Instagram',format:'feed',title:'A',copyText:''})}).success};
 fs.writeFileSync(path.join(root,'extraction-results.json'),JSON.stringify({rows,limits,node:process.version},null,2));console.log(JSON.stringify({rows,limits},null,2));
}
main();
