// Real UI + local SQLite persistence; only proposal generation is mocked.
import { chromium } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';

const dbPath=path.resolve(process.env.QA_DB??'');
assert(dbPath.startsWith(path.resolve(os.tmpdir())+'/approove-qa-'),'Disposable QA database required');
assert(fs.readFileSync('lib/import/claude.ts','utf8').includes('offline-fixture'),'Offline provider required');
const db=createClient({url:'file:'+dbPath});
const root=path.resolve('docs/qa/2026-10-23-ai-import');
const out=path.join(root,'supplement');fs.mkdirSync(path.join(out,'screenshots'),{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR',timezoneId:'UTC'});
const page=await context.newPage();const errors=[],warnings=[],blocked=[],externalResponses=[];
page.on('response',r=>{const u=new URL(r.url());if(!['localhost','127.0.0.1'].includes(u.hostname))externalResponses.push(u.origin);});
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='warning')warnings.push(m.text());});
await context.route('**/*',route=>{
 const url=new URL(route.request().url());
 if(['localhost','127.0.0.1'].includes(url.hostname))return route.continue();
 blocked.push(url.origin);return route.abort();
});
const result={ai:'MOCK - no inference, tokens or paid calls',database:'Disposable local SQLite',checks:[]};
const reviewedTitle='Persistência ordem alterada QA '+Date.now();
function check(name,details){result.checks.push({name,pass:true,...details});}
async function description(phase){
 await page.waitForFunction(()=>{const r=document.querySelector('[role=dialog]')?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;},{},{timeout:3000});
 const state=await page.getByRole('dialog').evaluate(el=>{
  const described=el.getAttribute('aria-describedby');const labelled=el.getAttribute('aria-labelledby');
  const desc=described?.split(' ').map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
  const title=labelled?.split(' ').map(id=>document.getElementById(id)?.textContent||'').join(' ').trim();
  return {desc,title,hasFocus:el.contains(document.activeElement),rect:{top:el.getBoundingClientRect().top,bottom:el.getBoundingClientRect().bottom},viewport:window.innerHeight};
 });
 assert.equal(state.title,'Importar com IA');assert(state.desc?.length>20);assert(state.hasFocus);
 assert(state.rect.top>=0&&state.rect.bottom<=state.viewport);check('Accessible dialog '+phase,state);
}
try{
 await page.goto('http://localhost:3015/login');
 await page.getByLabel('Email',{exact:true}).fill('admin@approove.com');
 await page.locator('#password').fill('admin123');
 await page.getByRole('button',{name:/^(Entrar|Log in)$/}).click();await page.waitForURL('**/dashboard');
 await page.goto('http://localhost:3015/dashboard/clients/demo-client');
 await page.getByRole('button',{name:'Importar com IA',exact:true}).click();
 await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();
 await description('upload desktop');
 await page.screenshot({path:path.join(out,'screenshots/upload-accessible-desktop.png')});
 const dir=path.join(root,'fixtures/03-apresentacao');const gold=JSON.parse(fs.readFileSync(path.join(dir,'expected.json'),'utf8'));
 await page.locator('input[type=file]').setInputFiles([...gold.documents,...gold.media].map(n=>path.join(dir,n)));
 await page.getByRole('button',{name:'Montar calendário'}).click();
 await page.getByLabel('Fuso dos horários',{exact:true}).waitFor({timeout:120000});
 const imageSources=await page.locator('[role=dialog] img').evaluateAll(imgs=>imgs.map(i=>i.getAttribute('src')));
 assert(imageSources.every(s=>s.startsWith('/dev-uploads/')),'All media must be local');
 await page.locator('[role=dialog] img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
 const original=['aurora-01.png','aurora-02.png','aurora-03.png'];
 const expected=['aurora-01.png','aurora-03.png','aurora-02.png'];
 await page.getByRole('button',{name:'Mover aurora-03.png antes',exact:true}).click();
 await page.getByLabel('Título da publicação',{exact:true}).first().fill(reviewedTitle);
 await description('review desktop');
 await page.screenshot({path:path.join(out,'screenshots/reordered-review-desktop.png')});
 await page.setViewportSize({width:390,height:844});
 await description('review mobile');
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);assert.equal(overflow,false);
 await page.screenshot({path:path.join(out,'screenshots/reordered-review-mobile.png')});
 // Focus remains inside modal during keyboard navigation.
 for(let i=0;i<12;i++) {await page.keyboard.press('Tab');assert(await page.getByRole('dialog').evaluate(e=>e.contains(document.activeElement)));}
 check('Keyboard focus stays inside dialog',{tabs:12,mobileOverflow:overflow});
 await page.setViewportSize({width:1440,height:1000});
 const responsePromise=page.waitForResponse(r=>r.url().endsWith('/commit')&&r.request().method()==='POST');
 const start=performance.now();await page.getByRole('button',{name:'Criar 4 publicações',exact:true}).click();
 const response=await responsePromise;const body=await response.json();assert.equal(response.status(),200);assert.equal(body.created,4);
 const requestPosts=response.request().postDataJSON().posts;
 assert.deepEqual(requestPosts[0].media,expected);assert.notDeepEqual(expected,original);
 const jobId=response.url().split('/').at(-2);
 const job=(await db.execute({sql:'SELECT mediaJson,status,postsCreated FROM ImportJob WHERE id=?',args:[jobId]})).rows[0];
 const namesByUrl=new Map(JSON.parse(job.mediaJson).map(m=>[m.url,m.name]));
 const slides=(await db.execute({sql:`SELECT s."order", s.url,s.mediaType,v.url AS versionUrl,a.type,p.status,p.productionStage FROM AttachmentSlide s
 JOIN AttachmentVersion v ON v.id=s.attachmentVersionId JOIN PostAttachment a ON a.id=v.postAttachmentId JOIN PostItem p ON p.id=a.postItemId
 WHERE p.title=? ORDER BY s."order"`,args:[reviewedTitle]})).rows;
 assert.deepEqual(slides.map(s=>namesByUrl.get(s.url)),expected);
 assert.deepEqual(slides.map(s=>s.order),[0,1,2]);assert(slides.every(s=>s.type==='carousel'&&s.status==='pending'&&s.productionStage==='internal_review'));
 assert.equal(slides[0].versionUrl,slides[0].url);assert.equal(job.status,'committed');
 check('Different final media order persisted after commit',{original,expected,persisted:slides.map(s=>({order:s.order,name:namesByUrl.get(s.url),mediaType:s.mediaType})),created:body.created,commitMs:performance.now()-start,jobStatus:job.status});
 assert.equal(errors.length,0);assert.equal(warnings.filter(w=>/DialogTitle|Description|aria-describedby/i.test(w)).length,0);
 assert.equal(externalResponses.length,0);check('No page errors, description warnings or successful nonlocal requests',{errors,warnings,blocked,externalResponses});
 result.pass=true;console.log(JSON.stringify(result,null,2));
}catch(error){result.pass=false;result.error=String(error);await page.screenshot({path:path.join(out,'screenshots/failure.png')});throw error;}
finally{Object.assign(result,{errors,warnings,blocked,externalResponses});fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));db.close();await browser.close();}
