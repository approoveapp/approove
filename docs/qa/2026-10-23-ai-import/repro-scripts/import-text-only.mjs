import { chromium } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createClient } from '@libsql/client';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';
const dbPath=path.resolve(process.env.QA_DB??'');if(!dbPath.startsWith(path.resolve(os.tmpdir())+'/approove-qa-'))throw Error('Disposable DB required');
const db=createClient({url:'file:'+dbPath});const root=path.resolve('docs/qa/2026-10-23-ai-import');
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',timezoneId:'UTC'});const page=await context.newPage();
await page.route('**/*',route=>new URL(route.request().url()).hostname==='localhost'?route.continue():route.abort());
try{
 await page.goto('http://localhost:3015/login');await page.locator('#email').fill('admin@approove.com');await page.locator('#password').fill('admin123');await page.getByRole('button',{name:/^(Entrar|Log in)$/}).click();await page.waitForURL('**/dashboard');await page.goto('http://localhost:3015/dashboard/clients/demo-client');
 await page.getByRole('button',{name:'Importar com IA',exact:true}).click();await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();
 await page.locator('input[type=file]').setInputFiles(path.join(root,'fixtures/01-texto/pauta.txt'));await page.getByRole('button',{name:'Montar calendário'}).click();await page.getByLabel('Fuso dos horários',{exact:true}).waitFor();
 const title=page.getByLabel('Título da publicação',{exact:true}).nth(1);await title.fill('LinkedIn texto aprovado na revisão QA');
 await page.getByLabel('Publicação só de texto (dispensa arte)',{exact:true}).nth(1).check();
 await title.scrollIntoViewIfNeeded();await page.waitForTimeout(250);await page.screenshot({path:path.join(root,'screenshots/text-only-mobile.png')});
 const done=page.waitForResponse(r=>r.url().endsWith('/commit'));await page.getByRole('button',{name:'Criar 3 publicações',exact:true}).click();const response=await done;if(response.status()!==200)throw Error('commit failed');
 const record=(await db.execute("SELECT status,productionStage,scheduledAt,handoffNote FROM PostItem WHERE title='LinkedIn texto aprovado na revisão QA'")).rows[0];
 if(record.status!=='pending'||record.productionStage!=='internal_review')throw Error('text-only stage incorrect');
 fs.writeFileSync(path.join(root,'text-only-results.json'),JSON.stringify({pass:true,record},null,2));
 console.log('Text-only UI + server stage verified.');
}finally{db.close();await browser.close();}
