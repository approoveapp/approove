import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSQL } from "@prisma/adapter-libsql";
import { createClient } from "@libsql/client";
import { reviewSummary, hasSourceTime, unconfirmedTimeCount } from "./review";
import { signImportMedia, verifyImportMedia } from "./media-receipt";
import type { ImportCommitPost, ImportMedia } from "./proposal";

let db: PrismaClient;
const ai = vi.hoisted(() => ({ propose: vi.fn(), auth: vi.fn() }));
vi.mock("@/auth", () => ({ auth: ai.auth }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: vi.fn() }));
vi.mock("@/lib/request-locale", () => ({ getRequestLocale: async () => "pt-BR" }));
vi.mock("@/lib/media-storage", () => ({
  DEV_UPLOADS_PREFIX: "/dev-uploads/", isMediaStorageConfigured: () => true,
  storeMedia: () => { throw new Error("Unexpected storage write in authorization test"); },
  deleteMedia: vi.fn(), listImportMedia: vi.fn(),
}));
vi.mock("next/server", async importOriginal => ({ ...await importOriginal<typeof import("next/server")>(), after: vi.fn() }));
import { NextRequest } from "next/server";
import * as jobRoute from "@/app/api/imports/[jobId]/route";
import * as commitRoute from "@/app/api/imports/[jobId]/commit/route";
import * as startRoute from "@/app/api/clients/[clientSlug]/imports/route";
import * as uploadRoute from "@/app/api/clients/[clientSlug]/imports/media/route";
vi.mock("@/lib/prisma", () => ({ get prisma() { return db; } }));
vi.mock("./claude", () => ({ proposeCalendar: ai.propose, ImportAiError: class extends Error {}, isImportAiConfigured: () => true }));
import { commitImport } from "./commit";
import { createImportJob, expireIfStale, runImportJob, countMonthlyImports } from "./jobs";
const work = mkdtempSync(join(tmpdir(), "approove-readiness-tests-"));
const url = `file:${join(work, "qa.db")}`;
const media: ImportMedia = { name: "a.png", url: "/api/import-media/org/import-a.png", mediaType: "image", mime: "image/png" };
const post: ImportCommitPost = { scheduledAt: "2026-11-01T13:00:00.000Z", channel: "LinkedIn", format: "feed", title: "Fictício", copyText: "Literal 🌱\nLinha 2", textOnly: true, media: [] };
const proposalPost = {date:"2026-11-01",time:"10:00",dateIsSuggested:false,channel:"LinkedIn",format:"feed",title:"Fictício",copyText:"Literal 🌱\nLinha 2",media:[],notes:null,source:"synthetic fixture"};
const proposal = { summary: "Contraditório", posts: Array.from({length:200},()=>({...proposalPost})), warnings: [] };
let sequence = 0;
async function job(status = "review", mediaList: ImportMedia[] = []) {
  return db.importJob.create({ data: { id: `job-${sequence++}`, organizationId: "org", clientId: "client", calendarVersionId: "calendar", status, filesJson: "[]", resultJson: JSON.stringify(proposal), mediaJson: JSON.stringify(mediaList) } });
}

beforeAll(async () => {
  vi.stubEnv("AUTH_SECRET", "synthetic-offline-test-secret-only");
  execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "db", "push", "--skip-generate", "--schema", resolve("prisma/schema.prisma")], {
    env: { NODE_ENV: "test", PATH: process.env.PATH, HOME: process.env.HOME, DATABASE_URL: url, TURSO_DATABASE_URL: "", TURSO_AUTH_TOKEN: "", ANTHROPIC_API_KEY: "", BLOB_READ_WRITE_TOKEN: "", IMPORT_BLOB_READ_WRITE_TOKEN: "", CHECKPOINT_DISABLE: "1" }, stdio: "pipe",
  });
  db = new PrismaClient({ adapter: new PrismaLibSQL(createClient({ url })) });
  await db.organization.create({ data: { id: "org", name: "QA fictícia", slug: "qa" } });
  await db.client.create({ data: { id: "client", name: "Fictício", slug: "ficticio", organizationId: "org" } });
  await db.calendarVersion.create({ data: { id: "calendar", clientId: "client", version: "v1" } });
  await db.user.create({ data: { id: "user", email: "qa@example.invalid" } });
});
beforeEach(async () => {
  await db.postItem.deleteMany(); await db.importJob.deleteMany(); ai.propose.mockReset();
  ai.auth.mockResolvedValue({ user: { id: "user" } });
  await db.organization.update({ where: { id: "org" }, data: { trialEndsAt: new Date(Date.now() + 86400000) } });
  await db.membership.upsert({ where: { userId_organizationId: { userId: "user", organizationId: "org" } }, create: { userId: "user", organizationId: "org", acceptedAt: new Date() }, update: { acceptedAt: new Date(), role: "member" } });
});
afterAll(async () => { await db?.$disconnect(); rmSync(work, { recursive: true, force: true }); vi.unstubAllEnvs(); });

describe("review integrity", () => {
  it("computes counts and dates from edited selection, excluding omitted rows", () => {
    const drafts = [{ include: true, scheduledLocal: "2026-11-02T10:00", copyText: "copy", media: ["a"] }, { include: false, scheduledLocal: "2026-10-01T10:00", copyText: "copy", media: ["b"] }];
    expect(reviewSummary(drafts, "pt-BR")).toBe("2 propostas; 1 selecionadas. 1 com legenda; 1 com mídia. Período selecionado: 2026-11-02 a 2026-11-02.");
    expect(reviewSummary(drafts, "en")).toBe("2 proposed; 1 selected. 1 with caption; 1 with media. Selected period: 2026-11-02 to 2026-11-02.");
    expect(unconfirmedTimeCount([{ include: true, timeConfirmed: false }, { include: false, timeConfirmed: false }, { include: true, timeConfirmed: true }])).toBe(1);
    expect(hasSourceTime(null)).toBe(false); expect(hasSourceTime("25:00")).toBe(false); expect(hasSourceTime("09:30")).toBe(true);
  });
});
describe("signed upload provenance", () => {
  it("binds metadata, organization, client and expiration; never trusts a Blob prefix alone", () => {
    const signed = { ...media, receipt: signImportMedia(media, "org", "client", 1800000000000) };
    expect(verifyImportMedia(signed, "org", "client", { now: 1800000000001 })).toBe(true);
    for (const changed of [{ ...signed, name: "b.png" }, { ...signed, url: "https://evil.public.blob.vercel-storage.com/uploads/org/import-a.png" }, { ...signed, mime: "video/mp4" }, { ...signed, receipt: undefined }]) expect(verifyImportMedia(changed, "org", "client")).toBe(false);
    expect(verifyImportMedia(signed, "other", "client")).toBe(false);
    expect(verifyImportMedia(signed, "org", "other")).toBe(false);
    expect(verifyImportMedia(signed, "org", "client", { now: 1800100000000 })).toBe(false);
    expect(verifyImportMedia(signed, "org", "client", { now: 1800100000000, admitted: true })).toBe(true);
  });
});
describe("SQLite/libsql atomic confirmation", () => {
  it("requires explicit acknowledgement for omitted media and warnings without claiming the job", async () => {
    const signed={...media,receipt:signImportMedia(media,"org","client")};
    const j=await job("review",[signed]);
    await expect(commitImport(j.id,"org",[post])).rejects.toMatchObject({status:400});
    expect((await db.importJob.findUniqueOrThrow({where:{id:j.id}})).status).toBe("review");
    await expect(commitImport(j.id,"org",[post],true)).resolves.toMatchObject({created:1});
  });
  it("refuses additions and duplicate/out-of-range proposal references atomically", async () => {
    const j=await job();
    await db.importJob.update({where:{id:j.id},data:{resultJson:JSON.stringify({...proposal,posts:[proposalPost]})}});
    await expect(commitImport(j.id,"org",[post,post],true)).rejects.toMatchObject({status:400});
    await expect(commitImport(j.id,"org",[{...post,sourceIndex:2}],true)).rejects.toMatchObject({status:400});
    expect(await db.postItem.count()).toBe(0);
  });
  it("concurrent identical confirmations create once and replay safely", async () => {
    const j = await job();
    const outcomes = await Promise.all([commitImport(j.id, "org", [post]), commitImport(j.id, "org", [post])]);
    expect(outcomes.map(o => o.alreadyCommitted).sort()).toEqual([false, true]);
    expect(await db.postItem.count()).toBe(1);
    const saved = await db.postItem.findFirstOrThrow();
    expect(saved.copyText).toBe(post.copyText); expect(saved.status).toBe("pending"); expect(saved.productionStage).toBe("internal_review");
    await expect(commitImport(j.id, "org", [{ ...post, title: "Diferente" }])).rejects.toMatchObject({ status: 409 });
  });
  it("rolls back claim and previous posts on an injected second-post failure", async () => {
    const j = await job();
    await db.$executeRawUnsafe(`CREATE TRIGGER qa_fail BEFORE INSERT ON PostItem WHEN NEW.title = 'FAIL' BEGIN SELECT RAISE(ABORT, 'qa fault'); END`);
    await expect(commitImport(j.id, "org", [post, { ...post, title: "FAIL" }])).rejects.toThrow();
    await db.$executeRawUnsafe("DROP TRIGGER qa_fail");
    expect(await db.postItem.count()).toBe(0);
    expect((await db.importJob.findUniqueOrThrow({ where: { id: j.id } })).status).toBe("review");
    expect((await commitImport(j.id, "org", [post])).created).toBe(1);
  });
  it("denies cross-organization access and foreign/unsigned job media without mutating the job", async () => {
    const j = await job("review", [media]);
    await expect(commitImport(j.id, "foreign", [post])).rejects.toMatchObject({ status: 404 });
    await expect(commitImport(j.id, "org", [{ ...post, media: ["not-here.png"] }])).rejects.toMatchObject({ status: 400 });
    await expect(commitImport(j.id, "org", [{ ...post, media: [media.name] }])).rejects.toMatchObject({ status: 400 });
    expect(await db.postItem.count()).toBe(0);
    expect((await db.importJob.findUniqueOrThrow({ where: { id: j.id } })).status).toBe("review");
  });
  it("persists manually changed carousel order and preserves duplicate occurrences", async () => {
    const items = [media, { ...media, name: "b.png", url: media.url.replace("a.png", "b.png") }].map(item => ({ ...item, receipt: signImportMedia(item, "org", "client") }));
    const j = await job("review", items);
    await commitImport(j.id, "org", [{ ...post, format: "carousel", media: ["b.png", "a.png"] }, post, post], true);
    expect(await db.postItem.count()).toBe(3);
    const slides = await db.attachmentSlide.findMany({ orderBy: { order: "asc" } });
    expect(slides.map(s => s.url)).toEqual([items[1].url, items[0].url]);
  });
});
describe("job lifecycle and admission", () => {
  it("expires stale jobs without overwriting a newer state", async () => {
    const j = await job("processing");
    await db.importJob.update({ where: { id: j.id }, data: { status: "review" } });
    expect((await expireIfStale(j, new Date(Date.now() + 700000))).status).toBe("review");
  });
  it("recovers legacy stale committing, while a recent claim remains untouched", async () => {
    const j = await job("committing");
    expect((await expireIfStale(j)).status).toBe("committing");
    expect((await expireIfStale(j, new Date(Date.now() + 700000))).status).toBe("review");
  });
  it("records a late inference cost without reviving the expired job; never retries it", async () => {
    const j = await job("processing");
    let release!: () => void;
    const gate = new Promise<void>(resolve => { release = resolve; });
    ai.propose.mockImplementation(async () => { await gate; return { proposal, model: "qa-mock", inputTokens: 12, outputTokens: 5 }; });
    const running = runImportJob(j.id, { clientName: "QA", files: [], media: [], locale: "pt-BR" as const });
    await vi.waitFor(() => expect(ai.propose).toHaveBeenCalledTimes(1));
    const fresh = await db.importJob.findUniqueOrThrow({ where: { id: j.id } });
    await expireIfStale(fresh, new Date(Date.now() + 700000)); release(); await running;
    const final = await db.importJob.findUniqueOrThrow({ where: { id: j.id } });
    expect(final.status).toBe("failed"); expect(final.inputTokens).toBe(12);
    await runImportJob(j.id, { clientName: "QA", files: [], media: [], locale: "pt-BR" as const });
    expect(ai.propose).toHaveBeenCalledTimes(1);
  });
  it("counts an uncertain paid attempt conservatively, excluding only proven pre-call failures", async () => {
    const j = await job("processing"); ai.propose.mockRejectedValue(new Error("timeout"));
    await runImportJob(j.id, { clientName: "QA", files: [], media: [], locale: "pt-BR" as const });
    await job("failed");
    expect(await countMonthlyImports("org")).toBe(1);
  });
  it("serializes simultaneous admission: one job per client, no quota overshoot", async () => {
    const input = { organizationId: "org", clientId: "client", calendarVersionId: "calendar", createdByUserId: "user", files: [], media: [], quotaLimit: 1, locale: "pt-BR" as const };
    const results = await Promise.allSettled([createImportJob(input), createImportJob(input)]);
    expect(results.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(await db.importJob.count()).toBe(1);
    await db.importJob.updateMany({ data: { status: "review" } });
    await expect(createImportJob(input)).rejects.toMatchObject({ status: 403 });
  });
});

async function authorizationResponses(jobId: string) {
  const request = (method: string, body?: unknown) => new NextRequest("http://localhost/api/qa", { method, ...(body !== undefined ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) });
  const clientParams = { params: Promise.resolve({ clientSlug: "ficticio" }) };
  const jobParams = { params: Promise.resolve({ jobId }) };
  return [
    await startRoute.GET(request("GET"), clientParams),
    await startRoute.POST(request("POST"), clientParams),
    await uploadRoute.POST(request("POST"), clientParams),
    await jobRoute.GET(request("GET"), jobParams),
    await commitRoute.POST(request("POST", { posts: [post], reviewAcknowledged:true }), jobParams),
    await jobRoute.DELETE(request("DELETE"), jobParams),
  ];
}
describe("real route handlers and membership/paywall logic; session lookup mocked", () => {
  it("rejects anonymous sessions at all six entry points", async () => {
    ai.auth.mockResolvedValue(null);
    expect((await authorizationResponses("missing")).map(r => r.status)).toEqual([401,401,401,401,401,401]);
  });
  it("rejects a pending invitation at all six entry points", async () => {
    await db.membership.updateMany({ data: { acceptedAt: null } });
    expect((await authorizationResponses("missing")).map(r => r.status)).toEqual([403,403,403,403,403,403]);
  });
  it("enforces expired trial at all six entry points, without Stripe calls", async () => {
    await db.organization.update({ where: { id: "org" }, data: { trialEndsAt: new Date(0) } });
    expect((await authorizationResponses("missing")).map(r => r.status)).toEqual([402,402,402,402,402,402]);
  });
  it("scopes every route to the accepted organization", async () => {
    const j = await job();
    await db.organization.upsert({ where: { id: "foreign" }, create: { id: "foreign", slug: "foreign", name: "Foreign QA", trialEndsAt: new Date(Date.now()+86400000) }, update: {} });
    await db.user.upsert({ where: { id: "foreign-user" }, create: { id: "foreign-user", email: "foreign@example.invalid" }, update: {} });
    await db.membership.upsert({ where: { userId_organizationId: { userId: "foreign-user", organizationId: "foreign" } }, create: { userId: "foreign-user", organizationId: "foreign", acceptedAt: new Date() }, update: { acceptedAt: new Date() } });
    ai.auth.mockResolvedValue({ user: { id: "foreign-user" } });
    expect((await authorizationResponses(j.id)).map(r => r.status)).toEqual([404,404,404,404,404,404]);
    expect((await db.importJob.findUniqueOrThrow({ where: { id: j.id } })).status).toBe("review");
  });
  it.each(["owner", "admin", "member"])("preserves accepted %s ability to review and commit", async role => {
    await db.membership.updateMany({ where: { userId: "user" }, data: { role } });
    const j = await job();
    const params = { params: Promise.resolve({ jobId: j.id }) };
    expect((await jobRoute.GET(new NextRequest("http://localhost"), params)).status).toBe(200);
    const response = await commitRoute.POST(new NextRequest("http://localhost", { method: "POST", body: JSON.stringify({ posts: [post], reviewAcknowledged:true }) }), params);
    expect(response.status).toBe(200); expect(await db.postItem.count()).toBe(1);
  });
  it("commits a full 200-item selection atomically", async () => {
    const j = await job();
    const outcome = await commitImport(j.id, "org", Array.from({ length: 200 }, (_, i) => ({ ...post, title: `QA ${i}` })));
    expect(outcome.created).toBe(200); expect(await db.postItem.count()).toBe(200);
  });
});

describe("admission edge cases", () => {
  it("admits a signed upload into only one job, including after discard", async () => {
    const item={...media,receipt:signImportMedia(media,"org","client")};
    const input={organizationId:"org",clientId:"client",calendarVersionId:"calendar",createdByUserId:"user",files:[],media:[item],quotaLimit:10,locale:"pt-BR" as const};
    const first=await createImportJob(input);
    await db.importJob.update({where:{id:first.id},data:{status:"discarded"}});
    await expect(createImportJob(input)).rejects.toMatchObject({status:409});
    expect(await db.importJob.count()).toBe(1);
  });
  it("does not start an inference for an already stale queued job", async () => {
    const j = await job("processing");
    await db.importJob.update({ where: { id: j.id }, data: { createdAt: new Date(Date.now()-700000) } });
    await runImportJob(j.id, { clientName: "QA", files: [], media: [], locale: "pt-BR" as const });
    expect(ai.propose).not.toHaveBeenCalled();
  });
  it("reserves the final quota slot across different clients", async () => {
    await db.client.upsert({ where: { id: "client2" }, create: { id: "client2", name: "QA 2", slug: "qa2", organizationId: "org" }, update: {} });
    await db.calendarVersion.upsert({ where: { id: "calendar2" }, create: { id: "calendar2", clientId: "client2", version: "v1" }, update: {} });
    const input = { organizationId: "org", clientId: "client", calendarVersionId: "calendar", createdByUserId: "user", files: [], media: [], quotaLimit: 1, locale: "pt-BR" as const };
    const outcomes = await Promise.allSettled([createImportJob(input), createImportJob({ ...input, clientId: "client2", calendarVersionId: "calendar2" })]);
    expect(outcomes.filter(r => r.status === "fulfilled")).toHaveLength(1);
    expect(outcomes.find(r => r.status === "rejected")).toMatchObject({ reason: { status: 403 } });
    expect(await db.importJob.count()).toBe(1);
  });
});
