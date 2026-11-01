import { chromium } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import fs from 'node:fs';import path from 'node:path';
const root=path.resolve('docs/qa/2026-10-23-ai-import');const out=path.join(root,'screenshots');
const browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:390,height:844},locale:'pt-BR',timezoneId:'UTC'});
const page=await context.newPage();const results=[];
page.on('dialog',d=>d.accept());
await page.route('**/*',route=>['localhost','127.0.0.1'].includes(new URL(route.request().url()).hostname)?route.continue():route.abort());
const check=(condition,name)=>{results.push({name,pass:condition});if(!condition)throw Error(name);};
try{
 await page.goto('http://localhost:3015/login');await page.locator('#email').fill('admin@approove.com');await page.locator('#password').fill('admin123');await page.getByRole('button',{name:/^(Entrar|Log in)$/}).click();await page.waitForURL('**/dashboard');await page.goto('http://localhost:3015/dashboard/clients/demo-client');
 const open=async()=>{await page.getByRole('button',{name:'Importar com IA',exact:true}).click();await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();};
 await open();
 await page.locator('input[type=file]').setInputFiles([{name:'arte.png',mimeType:'image/png',buffer:Buffer.from('a')},{name:'arte.png',mimeType:'image/png',buffer:Buffer.from('bb')}]);
 check(await page.getByRole('button',{name:'Montar calendário'}).isDisabled(),'same media names blocked before upload');await page.screenshot({path:path.join(out,'error-duplicate-filenames.png')});
 await page.keyboard.press('Escape');await page.getByRole('button',{name:'Importar com IA',exact:true}).click();await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();
 // Uploaded file selection intentionally stays in this tab. Remove it explicitly.
 for(let i=0;i<2;i++)await page.getByRole('button',{name:'Remover arte.png',exact:true}).first().click();
 await page.locator('input[type=file]').setInputFiles(path.join(root,'fixtures/negativos/instrucao.txt'));await page.getByRole('button',{name:'Montar calendário'}).click();
 await page.getByRole('button',{name:'Tentar de novo',exact:true}).waitFor({timeout:20000});check(true,'provider failure surfaces retry state');await page.screenshot({path:path.join(out,'error-provider-offline.png')});
 await page.getByRole('button',{name:'Tentar de novo',exact:true}).click();await page.getByRole('button',{name:'Remover instrucao.txt',exact:true}).click();
 await page.locator('input[type=file]').setInputFiles(path.join(root,'fixtures/01-texto/pauta.txt'));await page.getByRole('button',{name:'Montar calendário'}).click();await page.getByLabel('Fuso dos horários',{exact:true}).waitFor({timeout:30000});
 await page.waitForTimeout(300);
 const geometry=await page.getByRole('dialog').evaluate(el=>{const r=el.getBoundingClientRect();return {top:r.top,bottom:r.bottom,height:r.height,innerHeight,scrollWidth:el.scrollWidth,width:r.width,maxHeight:getComputedStyle(el).maxHeight};});results.push({name:'mobile dialog geometry',geometry});
 await page.screenshot({path:path.join(out,'mobile-final-state.png')});
 await page.route('**/api/imports/*',async route=>route.request().method()==='DELETE'?route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Falha simulada ao descartar. Tente novamente.'})}):route.fallback());
 await page.getByRole('button',{name:'Descartar',exact:true}).click();await page.getByRole('alert').filter({hasText:'Falha simulada'}).waitFor();check(await page.getByLabel('Título da publicação',{exact:true}).count()===3,'failed discard retains proposal');await page.screenshot({path:path.join(out,'error-discard-retains-review.png')});
 await page.unroute('**/api/imports/*');await page.getByRole('button',{name:'Descartar',exact:true}).click();await page.getByText('Arraste os arquivos ou clique para escolher').waitFor();check(true,'successful discard resets upload');
}catch(e){results.push({name:'script error',pass:false,error:e.message});await page.screenshot({path:path.join(out,'ui-states-failure.png')});process.exitCode=1;}
finally{fs.writeFileSync(path.join(root,'ui-states-results.json'),JSON.stringify(results,null,2));console.log(results);await browser.close();}
