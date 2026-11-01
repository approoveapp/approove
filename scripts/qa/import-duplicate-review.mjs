// Offline UI/SQLite regression: injected proposal, zero paid or storage calls.
import { chromium } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
const dbPath=path.resolve(process.env.QA_DB??'');
assert(dbPath.startsWith(path.resolve(os.tmpdir())+'/approove-qa-')&&dbPath.endsWith('/qa.db'));
assert(fs.readFileSync('lib/import/claude.ts','utf8').includes('offline-fixture'));
const out=path.resolve(process.env.QA_OUTPUT);fs.mkdirSync(out,{recursive:true});
const db=createClient({url:'file:'+dbPath});
const client=(await db.execute("SELECT c.id,c.organizationId,v.id versionId FROM Client c JOIN CalendarVersion v ON v.clientId=c.id WHERE c.slug='demo-client' LIMIT 1")).rows[0];
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'pt-BR'});const page=await context.newPage();
await context.route('**/*',r=>['localhost','127.0.0.1'].includes(new URL(r.request().url()).hostname)?r.continue():r.abort());
const result={ai:'injected mock; no inference',database:'disposable SQLite',checks:[]};
try{
 await page.goto('http://localhost:3015/login');await page.locator('#email').fill('admin@approove.com');await page.locator('#password').fill('admin123');await page.getByRole('button',{name:/^(Entrar|Log in)$/}).click();await page.waitForURL('**/dashboard');
 for(const remove of [false,true]){
  const id='qa-duplicates-'+(remove?'exclude':'keep')+'-'+Date.now();const title=id;
  const post={date:'2026-11-01',time:'09:30',dateIsSuggested:false,channel:'Instagram',format:'feed',title,copyText:'Texto fictício idêntico.',media:[],notes:null,source:'pauta.csv, linha 2'};
  const proposal={summary:'Quatro ocorrências: duas idênticas e duas recorrências distintas.',warnings:['As linhas 2 e 3 são idênticas; decida se deseja manter ambas.'],posts:[post,{...post,source:'pauta.csv, linha 3'},{...post,date:'2026-11-02',source:'pauta.csv, linha 4'},{...post,channel:'LinkedIn',source:'pauta.csv, linha 5'}]};
  await db.execute({sql:"INSERT INTO ImportJob (id,organizationId,clientId,calendarVersionId,status,filesJson,mediaJson,resultJson,updatedAt) VALUES (?,?,?,?,'review','[]','[]',?,?)",args:[id,client.organizationId,client.id,client.versionId,JSON.stringify(proposal),new Date().toISOString()]});
  await page.goto('http://localhost:3015/dashboard/clients/demo-client');await page.getByRole('button',{name:'Importar com IA',exact:true}).click();
  const includes=page.getByRole('checkbox',{name:'Incluir publicação',exact:true});await includes.first().waitFor();assert.equal(await includes.count(),4);
  for(let i=0;i<4;i++)assert(await includes.nth(i).isChecked());
  assert(await page.getByText(/Há 2 publicações aparentemente repetidas/).isVisible());
  assert.equal(await page.getByText(/nenhuma foi removida automaticamente/).count(),0);
  if(remove)await includes.nth(1).uncheck();
  const count=remove?3:4;
  if(remove)assert.equal(await page.getByText(/Há 2 publicações aparentemente repetidas/).count(),0);
  await page.screenshot({path:path.join(out,remove?'exclude-one-desktop.png':'keep-all-desktop.png')});
  if(remove){await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>{const r=document.querySelector('[role=dialog]')?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;});await page.screenshot({path:path.join(out,'exclude-one-mobile.png')});await page.setViewportSize({width:1440,height:1000});}
  const pending=page.waitForResponse(r=>r.url().endsWith('/commit')&&r.request().method()==='POST');await page.getByRole('button',{name:`Criar ${count} publicações`,exact:true}).click();const response=await pending;assert.equal(response.status(),200);assert.equal((await response.json()).created,count);
  const rows=(await db.execute({sql:'SELECT channel,scheduledAt,status,handoffNote FROM PostItem WHERE title=? ORDER BY scheduledAt,channel',args:[title]})).rows;
  assert.equal(rows.length,count);assert(rows.every(r=>r.status==='pending'));
  const noteSources=rows.map(r=>r.handoffNote);assert(noteSources.some(s=>s.includes('linha 4')));assert(noteSources.some(s=>s.includes('linha 5')));assert.equal(noteSources.some(s=>s.includes('linha 3')),!remove);
  result.checks.push({action:remove?'manually exclude exact duplicate':'explicitly keep all occurrences',created:count,posts:rows,pass:true});
 }
 result.pass=true;console.log(JSON.stringify(result,null,2));
}catch(e){result.pass=false;result.error=String(e);await page.screenshot({path:path.join(out,'failure.png')});throw e;}
finally{fs.writeFileSync(path.join(out,'browser-results.json'),JSON.stringify(result,null,2));await browser.close();db.close();}
