// Runs only against the disposable QA server. AI provider must be the offline fixture shim.
import { chromium } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
const base='http://localhost:3015';
const root=path.resolve('docs/qa/2026-10-23-ai-import');
const out=path.join(root,'screenshots');fs.mkdirSync(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'UTC',locale:'pt-BR'});
const page=await context.newPage();
const results=[];
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route('**/*',route=>{const url=new URL(route.request().url());return ['localhost','127.0.0.1'].includes(url.hostname)?route.continue():route.abort();});
const metrics=[];
page.on('response',async r=>{if(r.url().includes('/imports'))metrics.push({url:new URL(r.url()).pathname,status:r.status(),timing:r.request().timing()});});
try {
 await page.goto(base+'/login');
 await page.getByLabel('Email',{exact:true}).fill('admin@approove.com');
 await page.locator('#password').fill('admin123');
 await page.getByRole('button',{name:/^(Entrar|Log in)$/,exact:true}).click();
 await page.waitForURL('**/dashboard',{timeout:60000});
 await page.goto(base+'/dashboard/clients/demo-client');
 await page.getByRole('button',{name:'Importar com IA',exact:true}).waitFor({timeout:60000});
 await page.getByRole('button',{name:'Importar com IA',exact:true}).click();
 await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();
 await page.screenshot({path:path.join(out,'01-upload-desktop.png')});
 await page.locator('input[type=file]').setInputFiles(path.join(root,'fixtures/negativos/acima-4mb.txt'));
 if(!await page.getByRole('button',{name:'Montar calendário'}).isDisabled())throw Error('Oversize not blocked');
 await page.screenshot({path:path.join(out,'02-limit-validation.png')});
 await page.getByRole('button',{name:'Remover acima-4mb.txt',exact:true}).click();
 for(const caseId of fs.readdirSync(path.join(root,'fixtures')).filter(x=>/^0[1-6]-/.test(x))){
   const dir=path.join(root,'fixtures',caseId);const gold=JSON.parse(fs.readFileSync(path.join(dir,'expected.json'),'utf8'));
   const t=performance.now();
   await page.locator('input[type=file]').setInputFiles([...gold.documents,...gold.media].map(n=>path.join(dir,n)));
   const start=performance.now();
   await page.getByRole('button',{name:'Montar calendário'}).click();
   await page.getByText('Lendo os arquivos e montando o calendário...').waitFor({timeout:120000});
   const processingAt=performance.now();
   await page.screenshot({path:path.join(out,`${caseId}-processing.png`)});
   await page.getByLabel('Fuso dos horários',{exact:true}).waitFor({timeout:120000});
   const reviewAt=performance.now();
   const imageSources=await page.locator('[role=dialog] img').evaluateAll(imgs=>imgs.map(img=>img.getAttribute('src')));
   if(imageSources.some(src=>!src.startsWith('/dev-uploads/')))throw Error('QA isolation failed: nonlocal media URL');
   await page.locator('[role=dialog] img').evaluateAll(imgs=>Promise.all(imgs.map(img=>img.decode())));
   if(await page.getByLabel('Título da publicação',{exact:true}).count()!==gold.expectedPosts)throw Error('Incorrect review count '+caseId);
   await page.screenshot({path:path.join(out,`${caseId}-review-desktop.png`)});
   let edited=false;
   if(caseId==='01-texto'){
     await page.getByLabel('Título da publicação',{exact:true}).first().fill('Título revisado pelo humano');
     await page.keyboard.press('Escape');
     await page.getByRole('button',{name:'Importar com IA',exact:true}).click();
     await page.getByLabel('Fuso dos horários',{exact:true}).waitFor();
     if(await page.getByLabel('Título da publicação',{exact:true}).first().inputValue()!=='Título revisado pelo humano')throw Error('Review edits lost');
     edited=true;
   }
   if(caseId==='03-apresentacao'){
     await page.getByLabel('Adicionar arte a Pauta 07',{exact:true}).selectOption('convite.png');
     await page.getByRole('button',{name:'Mover convite.png antes',exact:true}).click();
     await page.getByRole('button',{name:'Tirar convite.png desta publicação',exact:true}).first().click();
     await page.getByLabel('Formato de Pauta 07',{exact:true}).selectOption('stories');
     await page.getByLabel('Formato de Pauta 07',{exact:true}).selectOption('carousel');
     edited=true;
   }
   await page.setViewportSize({width:390,height:844});
   await page.screenshot({path:path.join(out,`${caseId}-review-mobile.png`)});
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth);
   await page.setViewportSize({width:1440,height:1000});
   const commitAt=performance.now();
   const commitResponse=page.waitForResponse(r=>r.url().endsWith('/commit')&&r.request().method()==='POST');
   await page.getByRole('button',{name:`Criar ${gold.expectedPosts} publicações`,exact:true}).click();
   const res=await commitResponse;const data=await res.json();
   if(res.status()!==200||data.created!==gold.expectedPosts)throw Error('Commit failed '+JSON.stringify(data));
   const commitMs=performance.now()-commitAt;
   const duplicate=await context.request.post(res.url(),{data:res.request().postDataJSON()});
   if(duplicate.status()!==409)throw Error('Duplicate commit accepted');
   results.push({caseId,expected:gold.expectedPosts,created:data.created,uploadAndStartMs:processingAt-start,offlineProcessingAndPollMs:reviewAt-processingAt,automatedReviewMs:commitAt-reviewAt,commitMs,edited,mobileOverflow:overflow,repeatCommitStatus:duplicate.status(),totalMs:performance.now()-t,ai:'MOCK - no inference/tokens'});
   fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify({results,metrics,errors},null,2));
   await page.getByRole('button',{name:'Importar com IA',exact:true}).click();
   await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();
 }
 await page.screenshot({path:path.join(out,'final-upload.png')});
 console.log(JSON.stringify({results,errors},null,2));
} catch(e){await page.screenshot({path:path.join(out,'failure.png')});console.error(e);process.exitCode=1;}
finally{fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify({results,metrics,errors},null,2));await browser.close();}
