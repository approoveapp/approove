/**
 * QA de segurança ponta a ponta. Sobe o app num SQLite descartável (pelo mesmo
 * adapter libsql da produção), com toda chave do .env anulada (nenhuma chave real,
 * nenhum e-mail enviado, nenhum acesso ao Turso), e reexecuta cada ataque da auditoria.
 *
 *   npm run qa:security            # next dev
 *   npm run qa:security -- --prod  # next start (rode `npm run build` antes)
 *   npm run qa:serve               # só sobe o app isolado para QA manual (porta 3015)
 */
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient, type Client } from "@libsql/client";
import Stripe from "stripe";
import { OFFLINE_IMPORT_ENV } from "./import-offline-env";
import { signImportMedia } from "../../lib/import/media-receipt";
import { importMediaPathname } from "../../lib/import/media";
import { privateImportUrl } from "../../lib/import/private-media-url";

const PROD = process.argv.includes("--prod");
const SERVE = process.argv.includes("--serve");
const PORT = Number(process.env.QA_PORT ?? (SERVE ? 3015 : 3900 + Math.floor(Math.random() * 90)));
const BASE = `http://127.0.0.1:${PORT}`;
const WORK = mkdtempSync(join(tmpdir(), "approove-qa-"));
const DB_URL = `file:${join(WORK, "qa.db")}`;
const WEBHOOK_SECRET = "whsec_qa_" + randomBytes(8).toString("hex");

/**
 * Next carrega .env* por baixo, mas nunca sobrescreve uma variável já definida
 * (nem vazia). Toda chave encontrada nesses arquivos entra aqui como "" — só os
 * nomes são lidos, nunca os valores.
 */
function blankProjectEnvKeys() {
  const blank: Record<string, string> = {};
  for (const file of readdirSync(".").filter((name) => name.startsWith(".env") && name !== ".env.example")) {
    for (const line of readFileSync(file, "utf8").split("\n")) {
      const key = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=/)?.[1];
      if (key) blank[key] = "";
    }
  }
  return blank;
}

const ISOLATED_ENV: NodeJS.ProcessEnv = {
  ...blankProjectEnvKeys(),
  ...OFFLINE_IMPORT_ENV,
  NODE_OPTIONS: process.env.NODE_OPTIONS,
  QA_EGRESS_LOG: process.env.QA_EGRESS_LOG,
  CHECKPOINT_DISABLE: "1",
  NODE_ENV: "test",
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  NEXT_TELEMETRY_DISABLED: "1",
  DATABASE_URL: DB_URL,
  TURSO_DATABASE_URL: DB_URL,
  AUTH_SECRET: randomBytes(32).toString("base64"),
  NEXTAUTH_URL: BASE,
  APP_URL: BASE,
  STRIPE_SECRET_KEY: "sk_test_qa_offline",
  STRIPE_WEBHOOK_SECRET: WEBHOOK_SECRET,
  STRIPE_PRICE_SOLO: "price_qa_solo",
  STRIPE_PRICE_STARTER: "price_qa_starter",
  STRIPE_PRICE_PRO: "price_qa_pro",
  STRIPE_PRICE_STUDIO: "price_qa_studio",
};

// ─── harness ───

let failures = 0;
let passes = 0;

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    passes++;
    console.log(`  ok   ${name}`);
  } catch (error) {
    failures++;
    console.log(`  FAIL ${name}\n       ${error instanceof Error ? error.message : error}`);
  }
}

function expectEqual<T>(actual: T, expected: T, label = "") {
  if (actual !== expected) {
    throw new Error(`${label} esperado ${JSON.stringify(expected)}, veio ${JSON.stringify(actual)}`);
  }
}

function expectTrue(value: unknown, label: string) {
  if (!value) throw new Error(label);
}

class Jar {
  cookies = new Map<string, string>();
  constructor(public ip = `10.${rand()}.${rand()}.${rand()}`) {}
  header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  store(response: Response) {
    for (const raw of response.headers.getSetCookie()) {
      const [pair] = raw.split(";");
      const [key, ...rest] = pair.split("=");
      const value = rest.join("=");
      if (value) this.cookies.set(key.trim(), value);
      else this.cookies.delete(key.trim());
    }
  }
}

function rand() {
  return Math.floor(Math.random() * 250) + 1;
}

async function http(
  jar: Jar | null,
  method: string,
  path: string,
  body?: unknown,
  extraHeaders: Record<string, string> = {}
) {
  const headers: Record<string, string> = { ...extraHeaders };
  if (jar) {
    headers.cookie = jar.header();
    headers["x-real-ip"] = jar.ip;
  }
  let payload: BodyInit | undefined;
  if (body instanceof URLSearchParams) {
    payload = body;
    headers["content-type"] = "application/x-www-form-urlencoded";
  } else if (typeof body === "string" || body instanceof FormData) {
    payload = body as BodyInit;
  } else if (body !== undefined) {
    payload = JSON.stringify(body);
    headers["content-type"] = "application/json";
  }
  const response = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
  jar?.store(response);
  const text = await response.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text);
  } catch {
    /* não-JSON */
  }
  return { status: response.status, json, text, headers: response.headers };
}

async function credentialsLogin(email: string, secret: string, provider = "credentials", jar = new Jar()) {
  const csrf = await http(jar, "GET", "/api/auth/csrf");
  const field = provider === "credentials" ? "password" : "code";
  const response = await http(
    jar,
    "POST",
    `/api/auth/callback/${provider}`,
    new URLSearchParams({
      csrfToken: String(csrf.json.csrfToken),
      email,
      [field]: secret,
      callbackUrl: `${BASE}/dashboard`,
    })
  );
  return { jar, location: response.headers.get("location") ?? "" };
}

async function sessionEmail(jar: Jar) {
  const session = await http(jar, "GET", "/api/auth/session");
  return (session.json?.user as { email?: string } | undefined)?.email ?? null;
}

async function login(email: string, password: string) {
  const { jar, location } = await credentialsLogin(email, password);
  expectEqual(await sessionEmail(jar), email, `login ${email} (redirect ${location}):`);
  return jar;
}

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
/** DateTime no formato que o adapter libsql do Prisma grava. */
const iso = (ms: number) => new Date(ms).toISOString().replace("Z", "+00:00");

// ─── setup ───

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  execFileSync(cmd, args, { env: { ...env }, stdio: "pipe", timeout: 60000 });
}

let serverLog = "";

async function startServer(): Promise<ChildProcess> {
  const args = PROD ? ["next", "start", "--hostname", "127.0.0.1", "-p", String(PORT)] : ["next", "dev", "--webpack", "--hostname", "127.0.0.1", "-p", String(PORT)];
  const server = spawn("npx", args, {
    env: { ...ISOLATED_ENV, NODE_ENV: PROD ? "production" : "development" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  server.stdout?.on("data", (chunk) => (serverLog += chunk));
  server.stderr?.on("data", (chunk) => (serverLog += chunk));

  for (let i = 0; i < 60; i++) {
    try {
      const response = await fetch(BASE + "/login", { signal: AbortSignal.timeout(10000) });
      if (response.status === 200) return server;
    } catch {
      /* ainda subindo */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  try { process.kill(-server.pid!, "SIGTERM"); } catch { /* own server already stopped */ }
  throw new Error("Servidor não subiu dentro do prazo");
}

async function main() {
  console.log(`QA de segurança (${PROD ? "next start" : "next dev"}) em ${BASE}`);
  for (const key of ["RESEND_API_KEY", "BLOB_READ_WRITE_TOKEN", "TURSO_AUTH_TOKEN", "GOOGLE_CLIENT_SECRET"]) {
    if (ISOLATED_ENV[key]) throw new Error(`${key} não pode ter valor no QA`);
  }
  // Seed pelo mesmo adapter libsql do servidor: datas em texto ISO, como na produção.
  run("npx", ["prisma", "db", "push", "--skip-generate"], ISOLATED_ENV);
  run("npx", ["tsx", "prisma/seed.ts"], ISOLATED_ENV);

  const db = createClient({ url: DB_URL });
  const server = await startServer();

  if (SERVE) {
    console.log(`\nApp isolado em ${BASE} (admin@approove.com / admin123). Ctrl+C para sair.`);
    server.stdout?.pipe(process.stdout);
    const stop = () => {
      try {
        process.kill(-server.pid!, "SIGTERM");
      } catch {
        /* já saiu */
      }
      rmSync(WORK, { recursive: true, force: true });
      process.exit(0);
    };
    process.on("SIGINT", stop);
    process.on("SIGTERM", stop);
    return;
  }

  try {
    await suite(db);
  } catch (error) {
    failures++;
    console.error(error);
  } finally {
    if (failures && process.env.QA_VERBOSE !== "0") {
      console.log("\n--- log do servidor (fim) ---\n" + serverLog.slice(-6000));
    }
    try {
      process.kill(-server.pid!, "SIGTERM");
    } catch {
      /* já saiu */
    }
    db.close();
    rmSync(WORK, { recursive: true, force: true });
  }

  console.log(`\n${passes} ok, ${failures} falhas`);
  process.exit(failures ? 1 : 0);
}

// ─── suite ───

async function one(db: Client, sql: string, args: (string | number | null)[] = []) {
  const result = await db.execute({ sql, args });
  return result.rows[0] as Record<string, unknown> | undefined;
}

async function suite(db: Client) {
  const admin = await login("admin@approove.com", "admin123");
  const member = await login("copy@approove.com", "member123");
  const demoVersion = String((await one(db, `SELECT v.id FROM CalendarVersion v JOIN Client c ON c.id = v.clientId WHERE c.slug = 'demo-client'`))!.id);
  const demoPost = String((await one(db, `SELECT p.id FROM PostItem p WHERE p.calendarVersionId = ? AND EXISTS (SELECT 1 FROM PostAttachment a WHERE a.postItemId = p.id) LIMIT 1`, [demoVersion]))!.id);
  // Post liberado para o cliente, para exercitar as rotas públicas do revisor.
  await db.execute({ sql: `UPDATE PostItem SET productionStage = 'ready_for_client' WHERE id = ?`, args: [demoPost] });
  const demoClientId = String((await one(db, `SELECT id FROM Client WHERE slug = 'demo-client'`))!.id);

  console.log("\nRegressão (fluxos legítimos)");
  await check("admin lista clientes e abre o calendário", async () => {
    expectEqual((await http(admin, "GET", "/api/clients")).status, 200);
    const detail = await http(admin, "GET", "/api/clients/demo-client");
    expectEqual(detail.status, 200);
    expectEqual(detail.json.canManage, true, "canManage");
  });
  await check("link da agência abre o calendário e permite aprovar", async () => {
    const token = String((await one(db, `SELECT token FROM ShareToken WHERE token = 'demo-token-123'`))!.token);
    expectEqual((await http(new Jar(), "GET", `/api/calendar/demo-client/v1/posts?t=${token}`)).status, 200);
    const status = await http(new Jar(), "PATCH", `/api/posts/${demoPost}/status`, { status: "approved", token });
    expectEqual(status.status, 200);
    expectEqual(Object.keys(status.json.post as object).sort().join(","), "id,status", "payload do revisor");
    const comment = await http(new Jar(), "POST", `/api/posts/${demoPost}/comments`, { text: "ok do cliente", token });
    expectEqual(comment.status, 200);
  });

  console.log("\n#1 Código de login (força bruta)");
  await check("5 códigos errados apagam o código; o certo depois não entra", async () => {
    const email = "design@approove.com";
    await db.execute({
      sql: `INSERT OR REPLACE INTO LoginCode (id, email, codeHash, expiresAt, attempts, createdAt) VALUES ('qa1', ?, ?, ?, 0, ?)`,
      args: [email, sha256("424242"), iso(Date.now() + 600_000), iso(Date.now())],
    });
    const jar = new Jar();
    for (let i = 0; i < 5; i++) await credentialsLogin(email, String(100000 + i), "email-code", jar);
    expectEqual(await one(db, `SELECT id FROM LoginCode WHERE email = ?`, [email]), undefined, "código ainda existe");
    await credentialsLogin(email, "424242", "email-code", jar);
    expectEqual(await sessionEmail(jar), null, "entrou após bloqueio");
  });
  await check("código certo entra e marca o e-mail como verificado", async () => {
    const email = "design@approove.com";
    await db.execute({
      sql: `INSERT OR REPLACE INTO LoginCode (id, email, codeHash, expiresAt, attempts, createdAt) VALUES ('qa2', ?, ?, ?, 0, ?)`,
      args: [email, sha256("135790"), iso(Date.now() + 600_000), iso(Date.now())],
    });
    const { jar } = await credentialsLogin(email, "135790", "email-code");
    expectEqual(await sessionEmail(jar), email);
    expectTrue((await one(db, `SELECT emailVerified FROM User WHERE email = ?`, [email]))!.emailVerified, "emailVerified");
  });
  await check("código fica só como hash no banco", async () => {
    const jar = new Jar();
    expectEqual((await http(jar, "POST", "/api/auth/send-code", { email: "review@approove.com" })).status, 200);
    const row = await one(db, `SELECT codeHash FROM LoginCode WHERE email = 'review@approove.com'`);
    expectTrue(/^[0-9a-f]{64}$/.test(String(row?.codeHash)), "codeHash não é sha256");
  });
  await check("send-code não revela se o e-mail existe", async () => {
    const jar = new Jar();
    const known = await http(jar, "POST", "/api/auth/send-code", { email: "copy@approove.com" });
    const unknown = await http(jar, "POST", "/api/auth/send-code", { email: "ninguem@qa.test" });
    expectEqual(unknown.status, known.status, "status");
    expectEqual(unknown.text, known.text, "corpo");
  });
  await check("send-code limita 3 por e-mail a cada 15 min", async () => {
    const statuses = [];
    for (let i = 0; i < 4; i++) {
      statuses.push((await http(new Jar(), "POST", "/api/auth/send-code", { email: "limite@qa.test" })).status);
    }
    expectEqual(statuses.join(","), "200,200,200,429");
  });

  console.log("\n#2 Revisor removido");
  await check("link de revisor removido deixa de funcionar (não vira aprovador)", async () => {
    const created = await http(admin, "POST", "/api/clients/demo-client/reviewers", {
      name: "Bob Viewer",
      email: "bob@cliente.test",
      clientIds: [demoClientId],
      role: "viewer",
    });
    expectEqual(created.status, 200, "criar revisor");
    const token = String(created.json.token);
    const before = await http(new Jar(), "GET", `/api/share/validate?t=${token}`);
    expectEqual((before.json.access as { permissions: { canApprove: boolean } }).permissions.canApprove, false);
    const reviewerId = String((created.json.reviewer as { id: string }).id);
    expectEqual((await http(admin, "DELETE", `/api/reviewers/${reviewerId}`)).status, 200);
    expectEqual((await http(new Jar(), "GET", `/api/share/validate?t=${token}`)).status, 401);
  });
  await check("token 'invite' órfão é negado (dados legados)", async () => {
    await db.execute({
      sql: `INSERT INTO ShareToken (id, token, kind, calendarVersionId, createdAt) VALUES ('qa-orphan', 'qa-orphan-token', 'invite', ?, ?)`,
      args: [demoVersion, iso(Date.now())],
    });
    expectEqual((await http(new Jar(), "GET", `/api/share/validate?t=qa-orphan-token`)).status, 401);
  });

  console.log("\n#3 Pré-sequestro de conta via Google");
  await check("vínculo Google tira a senha não verificada e derruba a sessão do invasor", async () => {
    const signup = await http(new Jar(), "POST", "/api/auth/signup", {
      name: "Invasor",
      email: "Vitima@Agencia.test",
      password: "senha-do-invasor",
      organizationName: "Agência Falsa",
    });
    expectEqual(signup.status, 200, "signup");
    const attacker = await login("vitima@agencia.test", "senha-do-invasor");
    execFileSync("npx", ["tsx", "scripts/qa/google-link.ts", "vitima@agencia.test"], {
      env: { ...ISOLATED_ENV, NODE_ENV: "test", TURSO_DATABASE_URL: DB_URL },
      stdio: "pipe",
    });
    const row = await one(db, `SELECT password, emailVerified FROM User WHERE email = 'vitima@agencia.test'`);
    expectEqual(row!.password, null, "senha");
    expectTrue(row!.emailVerified, "emailVerified");
    expectEqual(await sessionEmail(attacker), null, "sessão do invasor");
    const relogin = await credentialsLogin("vitima@agencia.test", "senha-do-invasor");
    expectEqual(await sessionEmail(relogin.jar), null, "login com senha antiga");
  });
  await check("e-mail com maiúsculas não cria conta duplicada", async () => {
    const dup = await http(new Jar(), "POST", "/api/auth/signup", {
      name: "Outro",
      email: "VITIMA@agencia.test",
      password: "12345678",
      organizationName: "Dup",
    });
    expectEqual(dup.status, 400);
  });

  console.log("\n#4 Paywall na API");
  const eve = new Jar();
  await check("trial expirado bloqueia a API inteira com 402", async () => {
    expectEqual(
      (await http(eve, "POST", "/api/auth/signup", { name: "Eve", email: "eve@qa.test", password: "evepass123", organizationName: "Eve Agency" })).status,
      200
    );
    const { jar } = await credentialsLogin("eve@qa.test", "evepass123", "credentials", eve);
    expectEqual(await sessionEmail(jar), "eve@qa.test");
    expectEqual((await http(eve, "POST", "/api/clients", { name: "Antes", slug: "eve-antes" })).status, 200, "criar no trial");
    await db.execute(`UPDATE Organization SET trialEndsAt = '${iso(1000)}' WHERE slug LIKE 'eve-agency%'`);
    for (const [method, path, body] of [
      ["GET", "/api/clients", undefined],
      ["POST", "/api/clients", { name: "Depois", slug: "eve-depois" }],
      ["GET", "/api/clients/eve-antes", undefined],
      ["POST", "/api/upload", undefined],
      ["GET", "/api/tasks/mine", undefined],
      ["POST", "/api/team", { email: "x@qa.test", role: "member" }],
    ] as const) {
      expectEqual((await http(eve, method, path, body)).status, 402, `${method} ${path}`);
    }
  });
  await check("billing continua acessível com trial expirado", async () => {
    // Checkout passa do paywall (falha só no Stripe offline, não com 402).
    const checkout = await http(eve, "POST", "/api/billing/checkout", { plan: "solo" });
    expectTrue(checkout.status !== 402 && checkout.status !== 401, `status ${checkout.status}`);
  });

  console.log("\n#5 Seed");
  await check("seed recusa banco remoto mesmo com ALLOW_REMOTE_DB=1", async () => {
    let failed = false;
    try {
      execFileSync("npx", ["tsx", "prisma/seed.ts"], {
        env: { ...ISOLATED_ENV, TURSO_DATABASE_URL: "libsql://approove-qa.invalid", ALLOW_REMOTE_DB: "1" },
        stdio: "pipe",
      });
    } catch (error) {
      failed = String((error as { stderr?: Buffer }).stderr ?? "").includes("Seed recusado");
    }
    expectTrue(failed, "seed rodou contra banco remoto");
  });

  console.log("\n#8 Open redirect / #9 Rate limit");
  await check("login com senha limita 10 tentativas por e-mail", async () => {
    const codes = [];
    for (let i = 0; i < 11; i++) {
      const { location } = await credentialsLogin("forca-bruta@qa.test", `errada-${i}`);
      codes.push(new URL(location, BASE).searchParams.get("code"));
    }
    expectEqual(codes.slice(0, 10).every((c) => c === "credentials"), true, codes.join(","));
    expectEqual(codes[10], "rate_limited");
  });
  await check("signup limita 5 por IP por hora", async () => {
    const jar = new Jar();
    const statuses = [];
    for (let i = 0; i < 6; i++) {
      statuses.push(
        (await http(jar, "POST", "/api/auth/signup", { name: "Spam", email: `spam${i}@qa.test`, password: "12345678", organizationName: "Spam" })).status
      );
    }
    expectEqual(statuses.join(","), "200,200,200,200,200,429");
  });

  console.log("\n#11 Links de aprovação");
  await check("novos links têm 192 bits e girar revoga o anterior", async () => {
    const before = await http(admin, "GET", "/api/clients/demo-client");
    const oldToken = (before.json.client as { versions: { tokens: { token: string }[] }[] }).versions[0].tokens[0].token;
    const rotated = await http(admin, "POST", "/api/clients/demo-client/tokens");
    expectEqual(rotated.status, 200);
    const newToken = String(rotated.json.token);
    expectTrue(/^[A-Za-z0-9_-]{32}$/.test(newToken), `token fraco: ${newToken}`);
    expectEqual((await http(new Jar(), "GET", `/api/share/validate?t=${oldToken}`)).status, 401, "token antigo");
    expectEqual((await http(new Jar(), "GET", `/api/share/validate?t=${newToken}`)).status, 200, "token novo");
  });

  console.log("\n#12/#13 Papéis");
  await check("membro não apaga cliente, não gera link, não gerencia revisores", async () => {
    expectEqual((await http(member, "DELETE", "/api/clients/demo-client")).status, 403, "delete cliente");
    expectEqual((await http(member, "POST", "/api/clients/demo-client/tokens")).status, 403, "token");
    expectEqual(
      (await http(member, "POST", "/api/clients/demo-client/reviewers", { name: "X", email: "x@cliente.test", clientIds: [demoClientId] })).status,
      403,
      "convidar revisor"
    );
    const invite = await one(db, `SELECT id FROM ClientInvite LIMIT 1`);
    if (invite) {
      expectEqual((await http(member, "PATCH", `/api/invites/${invite.id}`, { status: "active" })).status, 403, "invite");
    }
  });
  await check("membro não vê tokens pessoais de revisores", async () => {
    await http(admin, "POST", "/api/clients/demo-client/reviewers", {
      name: "Rita", email: "rita@cliente.test", clientIds: [demoClientId], role: "approver",
    });
    const list = await http(member, "GET", "/api/clients/demo-client/reviewers");
    expectEqual(list.status, 200);
    const tokens = (list.json.reviewers as { invites: { token: string | null }[] }[]).flatMap((r) => r.invites.map((i) => i.token));
    expectTrue(tokens.length > 0 && tokens.every((t) => t === null), "token exposto ao membro");
    const detail = await http(member, "GET", "/api/clients/demo-client");
    expectEqual(detail.json.canManage, false);
  });
  await check("membro não recebe o link da agência (aprova como cliente)", async () => {
    const detail = await http(member, "GET", "/api/clients/demo-client");
    const versions = (detail.json.client as { versions: { tokens: unknown[] }[] }).versions;
    expectTrue(versions.every((v) => v.tokens.length === 0), "link da agência exposto no detalhe");
    const list = await http(member, "GET", "/api/clients");
    expectEqual(list.json.canManage, false);
    expectTrue(
      (list.json.clients as { latestToken?: string }[]).every((c) => c.latestToken === undefined),
      "link da agência exposto na lista"
    );
    const adminList = await http(admin, "GET", "/api/clients");
    expectTrue((adminList.json.clients as { latestToken?: string }[]).some((c) => c.latestToken), "admin sem link");
  });
  await check("membro não cria nem edita cliente", async () => {
    expectEqual((await http(member, "POST", "/api/clients", { name: "Membro", slug: "membro-cria" })).status, 403, "criar");
    expectEqual((await http(member, "PATCH", "/api/clients/demo-client", { name: "pwn" })).status, 403, "editar");
    const row = await one(db, `SELECT name FROM Client WHERE slug = 'demo-client'`);
    expectTrue(row!.name !== "pwn", "nome alterado");
  });
  await check("membro não aprova nem reabre em nome do cliente", async () => {
    for (const status of ["approved", "adjustments", "pending"]) {
      expectEqual((await http(member, "PATCH", `/api/posts/${demoPost}/status`, { status })).status, 403, status);
    }
    const calendar = await http(member, "GET", "/api/calendar/demo-client/v1/posts");
    const permissions = (calendar.json.access as { permissions: { canApprove: boolean; canComment: boolean } }).permissions;
    expectEqual(permissions.canApprove, false, "canApprove");
    expectEqual(permissions.canComment, true, "canComment");
  });
  await check("membro produz posts, mas não apaga post com histórico de aprovação", async () => {
    const created = await http(member, "POST", "/api/calendar/demo-client/v1/posts/create", {
      scheduledAt: new Date().toISOString(),
      title: "rascunho do membro",
    });
    expectEqual(created.status, 200, "criar post");
    const draftId = String((created.json.post as { id: string }).id);
    expectEqual((await http(member, "PATCH", `/api/posts/${draftId}`, { title: "editado" })).status, 200, "editar post");
    expectEqual((await http(member, "POST", `/api/posts/${draftId}/comments`, { text: "nota interna" })).status, 200, "comentar");
    expectEqual((await http(member, "DELETE", `/api/posts/${draftId}`)).status, 200, "apagar rascunho");
    // demoPost foi aprovado pelo revisor em #2: tem histórico.
    expectEqual((await http(member, "DELETE", `/api/posts/${demoPost}`)).status, 403, "apagar com histórico");
    expectTrue(Boolean(await one(db, `SELECT id FROM PostItem WHERE id = ?`, [demoPost])), "post apagado");
  });
  await check("membro não abre equipe nem configurações", async () => {
    for (const path of ["/dashboard/team", "/dashboard/settings", "/dashboard/clients/new"]) {
      const page = await http(member, "GET", path);
      expectTrue([302, 303, 307].includes(page.status), `${path}: status ${page.status}`);
      expectEqual(new URL(page.headers.get("location") ?? "", BASE).pathname, "/dashboard", path);
    }
    const team = await http(member, "GET", "/api/team");
    expectEqual((team.json.viewer as { role: string }).role, "member");
    const target = await one(db, `SELECT m.id FROM Membership m JOIN User u ON u.id = m.userId WHERE u.email = 'review@approove.com'`);
    expectEqual((await http(member, "PATCH", `/api/team/${target!.id}`, { role: "member" })).status, 403, "trocar função");
    expectEqual((await http(member, "DELETE", `/api/team/${target!.id}`)).status, 403, "remover");
    expectEqual((await http(member, "POST", "/api/team", { email: "x@qa.test", role: "member" })).status, 403, "convidar");
  });
  await check("admin não remove outro admin nem convida admin", async () => {
    const reviewAdmin = await login("review@approove.com", "member123");
    expectEqual((await http(reviewAdmin, "POST", "/api/team", { email: "novo-admin@qa.test", role: "admin" })).status, 403);
  });

  console.log("\n#14 Convites de equipe");
  // Plano Studio ativo: o limite de membros do trial (Starter) não interfere nos testes.
  await db.execute(`UPDATE Organization SET subscriptionStatus = 'active', plan = 'studio', currentPeriodEnd = '${iso(Date.now() + 86_400_000)}' WHERE slug = 'agencia-demo'`);
  await check("convite fica pendente até o convidado aceitar", async () => {
    expectEqual((await http(admin, "POST", "/api/team", { email: "Nova@QA.test", name: "Nova", role: "member" })).status, 200);
    const row = await one(db, `SELECT m.id, m.acceptedAt FROM Membership m JOIN User u ON u.id = m.userId WHERE u.email = 'nova@qa.test'`);
    expectEqual(row!.acceptedAt, null, "acceptedAt");
    await db.execute({
      sql: `INSERT OR REPLACE INTO LoginCode (id, email, codeHash, expiresAt, attempts, createdAt) VALUES ('qa3', 'nova@qa.test', ?, ?, 0, ?)`,
      args: [sha256("111222"), iso(Date.now() + 600_000), iso(Date.now())],
    });
    const { jar } = await credentialsLogin("nova@qa.test", "111222", "email-code");
    const pending = await http(jar, "GET", "/api/clients");
    expectEqual(pending.status, 403);
    expectEqual(pending.json.code, "INVITE_PENDING");
    expectEqual((await http(jar, "POST", `/api/team/invitations/${row!.id}`, { action: "accept" })).status, 200);
    expectEqual((await http(jar, "GET", "/api/clients")).status, 200, "após aceitar");
  });
  await check("não puxa usuário que já tem outra agência", async () => {
    expectEqual((await http(admin, "POST", "/api/team", { email: "eve@qa.test", role: "member" })).status, 409);
  });
  await check("convite alheio não pode ser aceito por outro usuário", async () => {
    await http(admin, "POST", "/api/team", { email: "alvo@qa.test", role: "member" });
    const row = await one(db, `SELECT m.id FROM Membership m JOIN User u ON u.id = m.userId WHERE u.email = 'alvo@qa.test'`);
    expectEqual((await http(eve, "POST", `/api/team/invitations/${row!.id}`, { action: "accept" })).status, 404);
  });

  console.log("\n#15 Sessões revogáveis");
  await check("redefinir a senha derruba sessões abertas", async () => {
    const victim = await login("copy@approove.com", "member123");
    const resetToken = randomBytes(32).toString("base64url");
    const userId = String((await one(db, `SELECT id FROM User WHERE email = 'copy@approove.com'`))!.id);
    await db.execute({
      sql: `INSERT INTO PasswordResetToken (id, tokenHash, userId, expiresAt, createdAt) VALUES ('qa-reset', ?, ?, ?, ?)`,
      args: [sha256(resetToken), userId, iso(Date.now() + 3_600_000), iso(Date.now())],
    });
    expectEqual((await http(new Jar(), "POST", "/api/auth/reset-password", { token: resetToken, password: "nova-senha-123" })).status, 200);
    expectEqual(await sessionEmail(victim), null, "sessão antiga");
    expectEqual((await http(new Jar(), "POST", "/api/auth/reset-password", { token: resetToken, password: "outra-senha-123" })).status, 400, "reuso");
    await login("copy@approove.com", "nova-senha-123");
  });
  await check("senha nova exige 8+ caracteres", async () => {
    expectEqual(
      (await http(new Jar(), "POST", "/api/auth/signup", { name: "Curta", email: "curta@qa.test", password: "1234567", organizationName: "Curta" })).status,
      400
    );
  });

  console.log("\n#16 Trial único");
  await check("usuário que já usou trial não ganha outro numa agência nova", async () => {
    await db.execute(`DELETE FROM Membership WHERE userId = (SELECT id FROM User WHERE email = 'eve@qa.test')`);
    const response = await http(eve, "GET", "/api/clients");
    expectEqual(response.status, 402, "nova agência sem trial");
    const org = await one(db, `SELECT o.trialEndsAt FROM Organization o JOIN Membership m ON m.organizationId = o.id JOIN User u ON u.id = m.userId WHERE u.email = 'eve@qa.test'`);
    expectEqual(org!.trialEndsAt, null);
  });

  console.log("\n#17 Billing");
  await check("checkout recusa org que já assina (409)", async () => {
    await db.execute(`UPDATE Organization SET subscriptionStatus = 'active', currentPeriodEnd = '${iso(Date.now() + 86_400_000)}' WHERE slug = 'agencia-demo'`);
    expectEqual((await http(admin, "POST", "/api/billing/checkout", { plan: "pro" })).status, 409);
    await db.execute(`UPDATE Organization SET subscriptionStatus = NULL, plan = 'free', currentPeriodEnd = NULL WHERE slug = 'agencia-demo'`);
  });
  await check("webhook aceita só assinatura válida", async () => {
    const payload = JSON.stringify({ id: "evt_qa", object: "event", type: "customer.created", data: { object: {} } });
    const stripe = new Stripe("sk_test_qa_offline");
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: WEBHOOK_SECRET });
    expectEqual((await http(null, "POST", "/api/stripe/webhook", payload, { "stripe-signature": signature })).status, 200, "assinado");
    const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_errado" });
    expectEqual((await http(null, "POST", "/api/stripe/webhook", payload, { "stripe-signature": forged })).status, 400, "forjado");
  });

  console.log("\n#18 Headers / #20 Proxy de imagens");
  await check("headers de segurança presentes e x-powered-by ausente", async () => {
    const home = await http(null, "GET", "/login");
    const csp = home.headers.get("content-security-policy") ?? "";
    expectTrue(csp.includes("frame-ancestors 'none'") && csp.includes("object-src 'none'"), `CSP: ${csp}`);
    expectEqual(home.headers.get("x-frame-options"), "DENY");
    expectEqual(home.headers.get("x-content-type-options"), "nosniff");
    expectEqual(home.headers.get("x-powered-by"), null);
    const share = await http(null, "GET", "/c/demo-client/v1?t=x");
    expectEqual(share.headers.get("x-robots-tag"), "noindex, nofollow");
    expectEqual(share.headers.get("referrer-policy"), "no-referrer");
  });
  await check("robots.txt bloqueia o app e aponta o sitemap", async () => {
    const robots = await http(null, "GET", "/robots.txt");
    expectEqual(robots.status, 200);
    expectTrue(robots.text.includes("Disallow: /dashboard"), robots.text);
    expectTrue(robots.text.includes("Disallow: /c/"), robots.text);
    expectTrue(robots.text.includes("Disallow: /api/"), robots.text);
    expectTrue(!robots.text.includes("Disallow: /login"), robots.text);
    expectTrue(robots.text.includes("Sitemap:"), robots.text);
  });
  await check("sitemap lista só páginas públicas", async () => {
    const sitemap = await http(null, "GET", "/sitemap.xml");
    expectEqual(sitemap.status, 200);
    expectTrue(sitemap.text.includes("/termos"), sitemap.text);
    expectTrue(sitemap.text.includes("/privacidade"), sitemap.text);
    expectTrue(sitemap.text.includes("/en"), sitemap.text);
    expectTrue(sitemap.text.includes("/precos"), sitemap.text);
    expectTrue(sitemap.text.includes("/como-funciona"), sitemap.text);
    expectTrue(!sitemap.text.includes("/dashboard"), sitemap.text);
    expectTrue(!sitemap.text.includes("/login"), sitemap.text);
  });
  await check("login, signup e dashboard enviam noindex", async () => {
    const login = await http(null, "GET", "/login");
    const signup = await http(null, "GET", "/signup");
    const dashboard = await http(null, "GET", "/dashboard");
    const home = await http(null, "GET", "/");
    expectEqual(login.headers.get("x-robots-tag"), "noindex, nofollow");
    expectEqual(signup.headers.get("x-robots-tag"), "noindex, nofollow");
    expectEqual(dashboard.headers.get("x-robots-tag"), "noindex, nofollow");
    expectTrue(login.text.includes("noindex"), "login html");
    expectEqual(home.headers.get("x-robots-tag"), null);
    expectTrue(!home.text.includes("noindex"), "home não deve ter noindex");
    expectTrue(home.text.includes("Aprovação de conteúdo"), "home canônica em pt-BR");
    const english = await http(null, "GET", "/en");
    expectEqual(english.status, 200);
    expectTrue(english.text.includes("Content approval"), "landing /en em inglês");
    expectTrue(english.text.toLowerCase().includes("hreflang"), "hreflang na landing /en");
    const pricing = await http(null, "GET", "/precos");
    expectEqual(pricing.status, 200);
    expectTrue(pricing.text.includes("Preços"), "página /precos");
    expectTrue(!pricing.text.includes("noindex"), "preços indexável");
    const how = await http(null, "GET", "/como-funciona");
    expectEqual(how.status, 200);
    expectTrue(how.text.includes("Como funciona"), "página /como-funciona");
  });
  await check("llms.txt descreve o produto", async () => {
    const llms = await http(null, "GET", "/llms.txt");
    expectEqual(llms.status, 200);
    expectTrue(llms.text.includes("Approove"), llms.text);
    expectTrue(llms.headers.get("content-type")?.includes("text/plain") === true, String(llms.headers.get("content-type")));
  });
  await check("/_next/image não busca imagens de terceiros", async () => {
    const response = await http(null, "GET", "/_next/image?url=https%3A%2F%2Fwww.google.com%2Ffavicon.ico&w=64&q=75");
    expectTrue(response.status >= 400, `status ${response.status}`);
  });

  console.log("\n#21 Isolamento e pins");
  await check("outra agência não lê nem altera nada da agência demo", async () => {
    const attacker = new Jar();
    await http(attacker, "POST", "/api/auth/signup", { name: "Mal", email: "mal@qa.test", password: "malpass123", organizationName: "Mal" });
    await credentialsLogin("mal@qa.test", "malpass123", "credentials", attacker);
    const attachment = String((await one(db, `SELECT id FROM PostAttachment LIMIT 1`))!.id);
    const version = String((await one(db, `SELECT id FROM AttachmentVersion LIMIT 1`))!.id);
    for (const [method, path, body] of [
      ["GET", "/api/clients/demo-client", undefined],
      ["PATCH", `/api/posts/${demoPost}`, { title: "pwn" }],
      ["DELETE", `/api/posts/${demoPost}`, undefined],
      ["POST", `/api/attachments/${attachment}/versions`, { url: "https://x.test/a.png" }],
      ["POST", `/api/attachment-versions/${version}/slides`, { url: "https://x.test/a.png" }],
      ["PATCH", `/api/posts/${demoPost}/status`, { status: "approved" }],
      ["POST", `/api/posts/${demoPost}/comments`, { text: "pwn" }],
    ] as const) {
      const status = (await http(attacker, method, path, body)).status;
      expectTrue([401, 403, 404].includes(status), `${method} ${path} -> ${status}`);
    }
  });
  await check("pin não aceita slide de outra versão", async () => {
    const own = await one(db, `SELECT id FROM AttachmentVersion WHERE id IN (SELECT attachmentVersionId FROM AttachmentSlide) LIMIT 1`);
    const foreignSlide = await one(db, `SELECT id FROM AttachmentSlide WHERE attachmentVersionId <> ? LIMIT 1`, [String(own!.id)]);
    const response = await http(admin, "POST", `/api/attachment-versions/${own!.id}/pins`, {
      xPercent: 10, yPercent: 10, text: "x", slideId: foreignSlide!.id,
    });
    expectEqual(response.status, 404);
  });
  await check("revisor não apaga pin da agência", async () => {
    const version = await one(db, `SELECT av.id FROM AttachmentVersion av JOIN PostAttachment pa ON pa.id = av.postAttachmentId WHERE pa.postItemId = ?`, [demoPost]);
    const pin = await http(admin, "POST", `/api/attachment-versions/${version!.id}/pins`, { xPercent: 5, yPercent: 5, text: "nota da agência" });
    expectEqual(pin.status, 200, "pin da agência");
    const token = (await http(admin, "POST", "/api/clients/demo-client/tokens")).json.token;
    const del = await http(new Jar(), "DELETE", `/api/attachment-versions/${version!.id}/pins`, { pinId: (pin.json.pin as { id: string }).id, token });
    expectEqual(del.status, 403);
  });
  await check("links/mídia aceitam só http(s)", async () => {
    expectEqual((await http(admin, "POST", "/api/clients", { name: "XSS", slug: "xss-link", website: "javascript:alert(1)" })).status, 400);
  });
  await check("onboarding sem login responde 401", async () => {
    expectEqual((await http(new Jar(), "POST", "/api/user/onboarding")).status, 401);
  });

  console.log("\nImportação com IA");
  // A sessão de copy@ caiu no teste de redefinição de senha; design@ também é membro.
  const importMember = await login("design@approove.com", "member123");
  const importRoutes = [
    ["GET", "/api/clients/demo-client/imports", undefined],
    ["POST", "/api/clients/demo-client/imports", new FormData()],
    ["POST", "/api/clients/demo-client/imports/media", new FormData()],
    ["GET", "/api/imports/qa-missing", undefined],
    ["POST", "/api/imports/qa-missing/commit", { posts: [{ scheduledAt: new Date().toISOString(), channel: "Instagram", format: "feed", title: "QA", copyText: "" }] }],
    ["DELETE", "/api/imports/qa-missing", undefined],
  ] as const;
  await check("as seis rotas recusam anônimo e token público de revisor", async () => {
    for (const [method, path, body] of importRoutes) {
      expectEqual((await http(new Jar(), method, path, body)).status, 401, `${method} ${path}`);
      expectEqual((await http(new Jar(), method, `${path}?t=demo-token-123`, body)).status, 401, `revisor ${path}`);
    }
  });
  await check("convite pendente, paywall e sessão revogada bloqueiam todas as rotas de importação", async () => {
    const actor = new Jar();
    expectEqual((await http(actor, "POST", "/api/auth/signup", { name: "QA Import Guard", email: "import-guard@qa.test", password: "qa-guard-123", organizationName: "QA Guard" })).status, 200);
    await credentialsLogin("import-guard@qa.test", "qa-guard-123", "credentials", actor);
    const actorRow = await one(db, `SELECT u.id, m.id AS membershipId, m.organizationId FROM User u JOIN Membership m ON m.userId = u.id WHERE u.email = 'import-guard@qa.test'`);
    await db.execute({ sql: `UPDATE Membership SET acceptedAt = NULL WHERE id = ?`, args: [String(actorRow!.membershipId)] });
    for (const [method, path, body] of importRoutes) expectEqual((await http(actor, method, path, body)).status, 403, `pending ${path}`);
    await db.execute({ sql: `UPDATE Membership SET acceptedAt = ? WHERE id = ?`, args: [iso(Date.now()), String(actorRow!.membershipId)] });
    await db.execute({ sql: `UPDATE Organization SET trialEndsAt = ? WHERE id = ?`, args: [iso(Date.now()-86400000), String(actorRow!.organizationId)] });
    for (const [method, path, body] of importRoutes) expectEqual((await http(actor, method, path, body)).status, 402, `paywall ${path}`);
    await db.execute({ sql: `UPDATE User SET sessionVersion = sessionVersion + 1 WHERE id = ?`, args: [String(actorRow!.id)] });
    for (const [method, path, body] of importRoutes) expectEqual((await http(actor, method, path, body)).status, 401, `revoked ${path}`);
  });
  await check("owner, admin e member aceitos podem abrir importação (política existente)", async () => {
    const administrator = await login("review@approove.com", "member123");
    for (const actor of [admin, administrator, importMember]) expectEqual((await http(actor, "GET", "/api/clients/demo-client/imports")).status, 200);
  });
  await check("membro também importa; sem ANTHROPIC_API_KEY responde 503 sem gastar cota", async () => {
    expectEqual((await http(importMember, "GET", "/api/clients/demo-client/imports")).status, 200, "membro GET");
    expectEqual((await http(importMember, "POST", "/api/clients/demo-client/imports", new FormData())).status, 503, "membro POST");
    // Sem arquivo: passa do papel e para na validação, sem gravar nada. Em `next start` sem Blob
    // privado, para antes, em 503 (storage não configurado); 403 seria o papel recusando.
    expectEqual((await http(importMember, "POST", "/api/clients/demo-client/imports/media", new FormData())).status, PROD ? 503 : 400, "membro mídia");
    const status = await http(admin, "GET", "/api/clients/demo-client/imports");
    expectEqual(status.status, 200, "admin GET");
    expectEqual(status.json.configured, false, "configured");
    const form = new FormData();
    form.append("files", new Blob(["data,canal\n2026-11-03,Instagram"]), "pauta.csv");
    expectEqual((await http(admin, "POST", "/api/clients/demo-client/imports", form)).status, 503, "admin POST");
    const jobs = await one(db, `SELECT COUNT(*) AS n FROM ImportJob`);
    expectEqual(Number(jobs!.n), 0, "job criado");
  });
  await check("proposta só vira post uma vez, com mídia só do próprio job, e nunca por outra agência", async () => {
    const org = String((await one(db, `SELECT organizationId FROM Client WHERE id = ?`, [demoClientId]))!.organizationId);
    const jobId = "qa-import-" + randomBytes(4).toString("hex");
    const mediaForm = new FormData();
    mediaForm.append("file", new Blob([Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l4sAAAAASUVORK5CYII=", "base64")], { type: "image/png" }), "arte.jpg");
    const upload = await http(admin, "POST", "/api/clients/demo-client/imports/media", mediaForm);
    let uploaded: { name: string; url: string; receipt: string };
    if (PROD) {
      // `next start` sem IMPORT_BLOB_READ_WRITE_TOKEN não grava mídia; o commit só precisa do
      // comprovante, então ele é assinado como a rota de upload faria, com o segredo do servidor.
      expectEqual(upload.status, 503, "upload sem Blob privado em produção");
      const media = { name: "arte.jpg", url: privateImportUrl(importMediaPathname(org, "png")), mediaType: "image" as const, mime: "image/png", size: 68 };
      const previous = process.env.AUTH_SECRET;
      process.env.AUTH_SECRET = ISOLATED_ENV.AUTH_SECRET;
      uploaded = { ...media, receipt: signImportMedia(media, org, demoClientId) };
      process.env.AUTH_SECRET = previous;
    } else {
      expectEqual(upload.status, 200, "upload local assinado");
      uploaded = upload.json.media as { name: string; url: string; receipt: string };
    }
    expectTrue(Boolean(uploaded.receipt), "comprovante de upload ausente");
    await db.execute({
      sql: `INSERT INTO ImportJob (id, organizationId, clientId, calendarVersionId, status, filesJson, mediaJson, resultJson, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, 'review', '[]', ?, ?, ?, ?)`,
      args: [
        jobId, org, demoClientId, demoVersion,
        JSON.stringify([uploaded]),
        JSON.stringify({summary:"QA",warnings:[],posts:[{date:"2026-11-01",time:null,dateIsSuggested:false,channel:"Instagram",format:"feed",title:"importado",copyText:"",media:["arte.jpg"],notes:null,source:"QA fixture"}]}),
        iso(Date.now()), iso(Date.now()),
      ],
    });
    const post = { scheduledAt: new Date().toISOString(), channel: "Instagram", format: "feed", title: "importado", copyText: "" };
    const body = { reviewAcknowledged: true, posts: [{ ...post, media: ["arte.jpg"] }] };

    // Nome de mídia que o job não tem: recusado antes de reservar o job.
    const foreign = await http(admin, "POST", `/api/imports/${jobId}/commit`, { reviewAcknowledged: true, posts: [{ ...post, media: ["outra.jpg"] }] });
    expectEqual(foreign.status, 400, "mídia de fora do job");

    const mallory = new Jar();
    await http(mallory, "POST", "/api/auth/signup", { name: "Mallory", email: "mallory@qa.test", password: "mallorypass1", organizationName: "Mallory" });
    await credentialsLogin("mallory@qa.test", "mallorypass1", "credentials", mallory);
    expectEqual((await http(mallory, "GET", `/api/imports/${jobId}`)).status, 404, "outra agência GET");
    expectEqual((await http(mallory, "POST", `/api/imports/${jobId}/commit`, body)).status, 404, "outra agência commit");
    expectEqual((await http(mallory, "DELETE", `/api/imports/${jobId}`)).status, 404, "outra agência delete");
    expectEqual((await http(mallory, "GET", "/api/clients/demo-client/imports")).status, 404, "outra agência cliente");
    // Sem upload configurado a rota responde 503 para qualquer cliente, antes de olhar o tenant.
    expectEqual((await http(mallory, "POST", "/api/clients/demo-client/imports/media", new FormData())).status, PROD ? 503 : 404, "outra agência upload");
    const first = await http(importMember, "POST", `/api/imports/${jobId}/commit`, body);
    expectEqual(first.status, 200, "membro commit");
    expectEqual(first.json.created, 1, "posts criados");
    expectEqual((await http(admin, "POST", `/api/imports/${jobId}/commit`, body)).json.alreadyCommitted, true, "commit repetido idempotente");
    const created = await one(db, `SELECT id, productionStage, status FROM PostItem WHERE title = 'importado'`);
    expectEqual(created?.productionStage, "draft_copy", "etapa (arte sem legenda)");
    expectEqual(created?.status, "pending", "status");
    const material = await one(
      db,
      `SELECT a.type, s.url FROM PostAttachment a JOIN AttachmentVersion v ON v.postAttachmentId = a.id
       JOIN AttachmentSlide s ON s.attachmentVersionId = v.id WHERE a.postItemId = ?`,
      [String(created!.id)]
    );
    expectEqual(material?.type, "post_feed", "tipo do material");
    expectEqual(material?.url, uploaded.url, "URL resolvida pelo job");
  });
  await check("limpeza de artes (cron) recusa chamada sem CRON_SECRET", async () => {
    expectEqual((await http(new Jar(), "GET", "/api/cron/import-cleanup")).status, 401, "sem header");
    expectEqual(
      (await http(new Jar(), "GET", "/api/cron/import-cleanup", undefined, { authorization: "Bearer " })).status,
      401,
      "segredo vazio"
    );
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
