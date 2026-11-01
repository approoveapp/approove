import { describe, expect, it } from "vitest";
import { ORPHAN_GRACE_MS, pickImportMediaToDelete, snapshotMediaUrls } from "./cleanup";

const now = new Date("2026-11-01T12:00:00Z");
const ago = (ms: number) => new Date(now.getTime() - ms);
const url = (name: string) => `https://x.public.blob.vercel-storage.com/uploads/org/import-${name}`;

describe("pickImportMediaToDelete", () => {
  const stored = [
    { url: url("no-post.jpg"), uploadedAt: ago(1000) },
    { url: url("descartada.jpg"), uploadedAt: ago(1000) },
    { url: url("orfa-recente.jpg"), uploadedAt: ago(1000) },
    { url: url("orfa-antiga.jpg"), uploadedAt: ago(ORPHAN_GRACE_MS + 1000) },
    { url: url("protegida-antiga.jpg"), uploadedAt: ago(ORPHAN_GRACE_MS * 30) },
  ];

  it("deletes closed-job leftovers at once and orphans only after the grace period", () => {
    const toDelete = pickImportMediaToDelete({
      stored,
      protectedUrls: new Set([url("no-post.jpg"), url("protegida-antiga.jpg")]),
      closedJobUrls: new Set([url("no-post.jpg"), url("descartada.jpg")]),
      now,
    });
    expect(toDelete).toEqual([url("descartada.jpg"), url("orfa-antiga.jpg")]);
  });

  it("never deletes protected media, even from a closed job", () => {
    const toDelete = pickImportMediaToDelete({
      stored,
      protectedUrls: new Set(stored.map((item) => item.url)),
      closedJobUrls: new Set(stored.map((item) => item.url)),
      now,
    });
    expect(toDelete).toEqual([]);
  });
});

describe("snapshotMediaUrls", () => {
  it("reads every media URL from an approval snapshot", () => {
    const snapshot = JSON.stringify([
      { id: "a", versions: [{ url: url("capa.jpg"), slides: [{ url: url("s1.jpg") }, { url: url("s2.mp4") }] }] },
    ]);
    expect(snapshotMediaUrls(snapshot)).toEqual([url("capa.jpg"), url("s1.jpg"), url("s2.mp4")]);
  });
});
