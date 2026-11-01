import { request } from '/Users/murillo/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs';
import { createClient } from '@libsql/client';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve('docs/qa/2026-10-23-ai-import');
const dbPath=path.resolve(process.env.QA_DB??'');
if(!dbPath.startsWith(path.resolve(os.tmpdir())+'/approove-qa-')||!dbPath.endsWith('/qa.db'))throw Error('Disposable QA database required');
const db=createClient({url:'file:'+dbPath});
const http=await request.newContext({baseURL:'http://localhost:3015'});
const csrf=await (await http.get('/api/auth/csrf')).json();
await http.post('/api/auth/callback/credentials',{form:{csrfToken:csrf.csrfToken,email:'admin@approove.com',password:'admin123',callbackUrl:'http://localhost:3015/dashboard'}});
const tests=[];
async function check(name,fn){try{await fn();tests.push({name,pass:true});}catch(e){tests.push({name,pass:false,error:e.message});}}
const expect=(got,want)=>{if(got!==want)throw Error(`expected ${want}, got ${got}`);};
const post=(url,data)=>http.post(url,{data});
const route='/api/clients/demo-client/imports';
await check('rejects oversized document before AI',async()=>{
 expect((await http.post(route,{multipart:{files:{name:'large.txt',mimeType:'text/plain',buffer:Buffer.alloc(4194305,97)}}})).status(),413);
});
await check('rejects text over 300k chars',async()=>{
 expect((await http.post(route,{multipart:{files:{name:'large.txt',mimeType:'text/plain',buffer:Buffer.alloc(300001,97)}}})).status(),400);
});
await check('rejects corrupt DOCX',async()=>{
 expect((await http.post(route,{multipart:{files:{name:'broken.docx',mimeType:'application/octet-stream',buffer:Buffer.from('PK\x03\x04word/document.xml broken')}}})).status(),400);
});
await check('rejects invalid media bytes',async()=>{
 expect((await http.post(route+'/media',{multipart:{file:{name:'fake.png',mimeType:'image/png',buffer:Buffer.from('not an image')}}})).status(),400);
});
await check('rejects media above 4MB',async()=>{
 expect((await http.post(route+'/media',{multipart:{file:{name:'large.png',mimeType:'image/png',buffer:Buffer.alloc(4194305)}}})).status(),413);
});
const existing=(await db.execute('SELECT * FROM ImportJob LIMIT 1')).rows[0];
const postData={scheduledAt:'2026-11-25T12:30:00Z',channel:'LinkedIn',format:'article',title:'Atomic QA synthetic',copyText:'Texto fictício para regressão.'};
await check('rejects 201 posts without writing',async()=>expect((await post(`/api/imports/${existing.id}/commit`,{posts:Array(201).fill(postData)})).status(),400));
await check('unknown media cannot be attached',async()=>expect((await post(`/api/imports/${existing.id}/commit`,{posts:[{...postData,media:['foreign.png']}]})).status(),400));
await check('anonymous cannot access import',async()=>{
 const guest=await request.newContext({baseURL:'http://localhost:3015'});expect((await guest.get(`/api/imports/${existing.id}`)).status(),401);await guest.dispose();
});
await check('posts and final job state roll back together after DB failure',async()=>{
 await db.execute({sql:"INSERT INTO ImportJob (id,organizationId,clientId,calendarVersionId,status,filesJson,mediaJson,updatedAt) VALUES (?,?,?,?, 'review','[]','[]',?)",args:['qa-atomic',existing.organizationId,existing.clientId,existing.calendarVersionId,new Date().toISOString()]});
 await db.execute("CREATE TRIGGER qa_fail_commit BEFORE UPDATE OF status ON ImportJob WHEN NEW.id='qa-atomic' AND NEW.status='committed' BEGIN SELECT RAISE(ABORT,'QA injected failure'); END");
 try{
  expect((await post('/api/imports/qa-atomic/commit',{posts:[postData]})).status(),500);
  expect(Number((await db.execute("SELECT count(*) n FROM PostItem WHERE title='Atomic QA synthetic'")).rows[0].n),0);
  expect((await db.execute("SELECT status FROM ImportJob WHERE id='qa-atomic'")).rows[0].status,'review');
 }finally{await db.execute('DROP TRIGGER qa_fail_commit');}
 expect((await post('/api/imports/qa-atomic/commit',{posts:[postData]})).status(),200);
 expect(Number((await db.execute("SELECT count(*) n FROM PostItem WHERE title='Atomic QA synthetic'")).rows[0].n),1);
});
await check('all imported posts are pending and never ready_for_client',async()=>{
 const rows=(await db.execute("SELECT status,productionStage FROM PostItem WHERE title like 'Pauta %' OR title like 'Lote %' OR title='Título revisado pelo humano' OR title='Atomic QA synthetic'")).rows;
 expect(rows.length,246);if(rows.some(p=>p.status!=='pending'||p.productionStage==='ready_for_client'))throw Error('Imported post approved');
});
await check('browser in UTC still saves 09:30 Sao Paulo as 12:30Z',async()=>{
 const row=(await db.execute("SELECT scheduledAt FROM PostItem WHERE title='Título revisado pelo humano'")).rows[0];
 expect(new Date(row.scheduledAt).toISOString(),'2026-11-01T12:30:00.000Z');
});
await check('all upload URLs are local',async()=>{
 const rows=(await db.execute('SELECT mediaJson FROM ImportJob')).rows;
 if(rows.flatMap(r=>JSON.parse(r.mediaJson)).some(m=>!m.url.startsWith('/dev-uploads/')))throw Error('Nonlocal media');
});
fs.writeFileSync(path.join(root,'api-results.json'),JSON.stringify(tests,null,2));console.log(JSON.stringify(tests,null,2));
db.close();await http.dispose();if(tests.some(t=>!t.pass))process.exitCode=1;
