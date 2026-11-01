"""Prepare QA instrumentation only; no credential read until the harness is run."""
from pathlib import Path
import subprocess, shutil
src=Path('/tmp/approove-import-qa-20261023')
output=subprocess.check_output(['python3',str(src/'scripts/qa/import-qa-prepare.py')],cwd=src,text=True)
dst=Path(output.split('Isolated copy: ')[1].splitlines()[0])
p=dst/'lib/import/claude.ts';s=(src/'lib/import/claude.ts').read_text()
s='import { reserveLiveCall, completeLiveCall } from "@/scripts/qa/import-live-budget";\n'+s
s=s.replace('const client = new Anthropic({ maxRetries: 0 });','''const client = new Anthropic({maxRetries:0,timeout:120000,baseURL:"https://api.anthropic.com"});
  const blocks = [...toContentBlocks(input.files), ...(await mediaBlocks(input.media)), {type:"text" as const,text:userInstructions(input)}];
  const reservation = await reserveLiveCall(client, model, SYSTEM_PROMPT, blocks);''')
s=s.replace('max_tokens: 64000','max_tokens: 8000')
s=s.replace('    betas: ["server-side-fallback-2026-07-01"],\n    // Se o modelo recusar por política, a API reenvia ao modelo de fallback padrão.\n    fallbacks: "default",\n','')
s=s.replace('''content: [
          ...toContentBlocks(input.files),
          ...(await mediaBlocks(input.media)),
          { type: "text", text: userInstructions(input) },
        ],''','content: blocks,')
s=s.replace('const message = await stream.finalMessage();','''const message = await stream.finalMessage();
  completeLiveCall(reservation, message);''')
p.write_text(s)
shutil.copy2(src/'live-budget-template.ts',dst/'scripts/qa/import-live-budget.ts')
p=dst/'scripts/qa/security.ts';s=p.read_text();s=s.replace('  const server = await startServer();','''  const keyDirectory=process.env.QA_KEY_DIRECTORY;
  if(!keyDirectory)throw new Error("Explicit QA key directory required");
  let key="";
  for(const name of [".env",".env.local"]){
    const file=join(keyDirectory,name);
    if(!existsSync(file))continue;
    for(const line of readFileSync(file,"utf8").split("\\n")){
      const match=line.match(/^\\s*(?:export\\s+)?ANTHROPIC_API_KEY\\s*=\\s*(.*?)\\s*$/);
      if(match?.[1])key=match[1].replace(/^(["'])(.*)\\1$/,"$2");
    }
  }
  if(!key)throw new Error("Anthropic key not available");
  ISOLATED_ENV.ANTHROPIC_API_KEY=key;
  ISOLATED_ENV.ANTHROPIC_IMPORT_MODEL="claude-haiku-5-5";
  const server = await startServer();''')
if 'existsSync' not in s.split('from "node:fs"')[0]:
    s='import { existsSync } from "node:fs";\n'+s
p.write_text(s)
p=dst/'scripts/qa/import-supplement-browser.mjs';s=p.read_text()
s=s.replace("assert(fs.readFileSync('lib/import/claude.ts','utf8').includes('offline-fixture'),'Offline provider required');","assert(fs.readFileSync('lib/import/claude.ts','utf8').includes('reserveLiveCall'),'Budgeted real provider required');")
s=s.replace("path.join(root,'supplement')","path.join(root,'live-browser-haiku')")
s=s.replace("ai:'MOCK - no inference, tokens or paid calls'","ai:'REAL Anthropic Haiku 5.5; explicit configuration, budgeted single request, retries and fallback disabled'")
s=s.replace('SELECT mediaJson,status,postsCreated FROM ImportJob','SELECT mediaJson,status,postsCreated,model FROM ImportJob')
s=s.replace("assert.equal(job.status,'committed');","assert.equal(job.status,'committed');assert.equal(job.model,'claude-haiku-5-5');")
# AI may preserve the brand prefix in source headings. Select the carousel by its media controls.
s=s.replace("const original=['aurora-01.png'", "const original=['aurora-01.png'")
p.write_text(s)
print(dst)
