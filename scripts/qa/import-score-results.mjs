// Rescore saved provider outputs only; no network, credentials, or changes to the ledger.
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve('docs/qa/2026-10-23-ai-import');
const ledger=JSON.parse(fs.readFileSync(path.join(root,'benchmark/ledger.json'),'utf8'));
const results=[];
for(const row of ledger.filter(r=>r.status==='complete'&&(/^0[1-6]-/.test(r.caseId)||/^(hard|clarity)--/.test(r.caseId)))){
 const fixture=/^(hard|clarity)--/.test(row.caseId)?path.join('supplement',row.caseId.replace(/^(hard|clarity)--/,'')):row.caseId;
 const gold=JSON.parse(fs.readFileSync(path.join(root,'fixtures',fixture,'expected.json'),'utf8'));
 const actual=JSON.parse(fs.readFileSync(path.join(root,'benchmark',`${row.caseId}-${row.requestedModel}.json`),'utf8'));
 const available=new Set(actual.posts.map((_,i)=>i));const differences=[];
 const count={copy:0,date:0,time:0,dateIsSuggested:0,channel:0,format:0,mediaOrder:0,titleLiteral:0,titleWithoutDocumentBrand:0,coreCorrect:0};
 let matched=0,unmatchedExpected=0;
 for(const exp of gold.proposal?.posts??[]){
  let index=[...available].find(i=>actual.posts[i].title===exp.title&&actual.posts[i].channel===exp.channel);
  if(index===undefined){
   const sameSlot=[...available].filter(i=>actual.posts[i].date===exp.date&&actual.posts[i].channel===exp.channel);
   if(sameSlot.length===1)index=sameSlot[0];
  }
  if(index===undefined){unmatchedExpected++;differences.push({title:exp.title,issue:'unmatched; inspect before classifying missing'});continue;}
  matched++;available.delete(index);const got=actual.posts[index];
  const fields={copy:got.copyText===exp.copyText,date:got.date===exp.date,time:got.time===exp.time,dateIsSuggested:got.dateIsSuggested===exp.dateIsSuggested,
   channel:got.channel===exp.channel,format:got.format===exp.format,mediaOrder:JSON.stringify(got.media)===JSON.stringify(exp.media),
   titleLiteral:got.title===exp.title,titleWithoutDocumentBrand:got.title.replace(/^Oficina Aurora\s*\|\s*/,'')===exp.title};
  for(const [k,v] of Object.entries(fields))if(v)count[k]++;
  if(['copy','date','time','dateIsSuggested','channel','format','mediaOrder'].every(k=>fields[k]))count.coreCorrect++;
  if(Object.values(fields).some(v=>!v))differences.push({title:exp.title,actualTitle:got.title,fields});
 }
 results.push({caseId:row.caseId,model:row.requestedModel,expected:gold.expectedPosts,found:actual.posts.length,matched,unmatchedExpected:gold.proposal?unmatchedExpected:null,unmatchedActual:gold.proposal?available.size:null,
  counts:count,differences,latencyMs:row.latencyMs,costUSD:row.costUSD,costPerCoreCorrect:count.coreCorrect?row.costUSD/count.coreCorrect:null,
  usage:row.usage,warnings:actual.warnings,semanticReview:gold.proposal?'See manual audit for warnings, timezone and text-only':'No fixed post count gold; manually assess invented content and grouping assumptions'});
}
fs.writeFileSync(path.join(root,'benchmark/scored-results.json'),JSON.stringify({method:'One-to-one title+channel; fallback only for unique date+channel. Core includes literal copy, date, time, suggested flag, channel, format and ordered media. Titles separately scored, brand-prefix normalization explicit. No model output used as truth.',results},null,2));
console.log('Scored',results.length,'saved responses. No API calls.');
