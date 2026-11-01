"""Prepare (do not start) a disposable copy for the six offline import scenarios.
Uses installed dependencies; never copies .env files, databases or existing uploads.
Run from the Approove repository: python3 scripts/qa/import-qa-prepare.py
"""
from pathlib import Path
import tempfile, shutil

src=Path(__file__).resolve().parents[2]
dst=Path(tempfile.mkdtemp(prefix='approove-import-offline-'))
for name in ['app','components','lib','prisma','scripts','public']:
    shutil.copytree(src/name,dst/name,ignore=shutil.ignore_patterns('*.db','*.db-*','dev-uploads','node_modules','__pycache__'))
for name in ['package.json','package-lock.json','tsconfig.json','next-env.d.ts','next.config.ts','postcss.config.mjs','tailwind.config.ts','eslint.config.mjs','vitest.config.ts','auth.ts','proxy.ts','components.json']:
    if (src/name).exists(): shutil.copy2(src/name,dst/name)
(dst/'node_modules').symlink_to(src/'node_modules',target_is_directory=True)
rel=Path('docs/qa/2026-10-23-ai-import/fixtures')
shutil.copytree(src/rel,dst/rel)
# This shim is intentionally confined to the disposable copy; the app keeps the real provider.
(dst/'lib/import/claude.ts').write_text('''
import fs from "node:fs/promises";
import path from "node:path";
export const IMPORT_MODEL = "offline-fixture";
export const isImportAiConfigured = () => true;
export type ImportAiUsage = {model:string;inputTokens:number;outputTokens:number};
export class ImportAiError extends Error { constructor(message:string,public usage?:ImportAiUsage){super(message);} }
export async function proposeCalendar(input: {files:{name:string}[]}) {
 const root=path.resolve("docs/qa/2026-10-23-ai-import/fixtures");
 for(const name of await fs.readdir(root)) {
  if(!/^0[1-6]-/.test(name))continue;
  const gold=JSON.parse(await fs.readFile(path.join(root,name,"expected.json"),"utf8"));
  if(gold.documents.includes(input.files[0]?.name)) {
   await new Promise(resolve=>setTimeout(resolve,900));
   return {proposal:gold.proposal,model:IMPORT_MODEL,inputTokens:0,outputTokens:0};
  }
 }
 throw new ImportAiError("Fixture offline desconhecida; nenhuma API externa foi chamada.");
}
''')
# QA compatibility only: webpack resolves the external node_modules symlink.
p=dst/'scripts/qa/security.ts'
s=p.read_text().replace('["next", "dev", "-p", String(PORT)]','["next", "dev", "--webpack", "--hostname", "127.0.0.1", "-p", String(PORT)]')
s=s.replace('["next", "dev", "--webpack", "-p", String(PORT)]','["next", "dev", "--webpack", "--hostname", "127.0.0.1", "-p", String(PORT)]')
if 'OFFLINE_IMPORT_ENV' not in s: raise RuntimeError('Install the explicit offline environment guard first')
s=s.replace('console.log(`QA de segurança (${PROD ? "next start" : "next dev"}) em ${BASE}`);','console.log(`QA de segurança em ${BASE}; banco descartável: ${DB_URL}`);')
p.write_text(s)
p=dst/'tailwind.config.ts'
s=p.read_text()
if 'import animate from "tailwindcss-animate";' not in s:
    s=s.replace('import type { Config } from "tailwindcss";', 'import type { Config } from "tailwindcss";\nimport animate from "tailwindcss-animate";')
s=s.replace('require("tailwindcss-animate")','animate')
p.write_text(s)
print('Isolated copy:',dst)
print('Start inside that directory: node --import tsx scripts/qa/security.ts --serve')
print('Then: node scripts/qa/import-browser.mjs')
print('Never run the browser suite against your normal development/production server.')
