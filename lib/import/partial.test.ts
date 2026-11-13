import { describe, expect, it } from "vitest";
import { extractPartialPosts, parseProgress, serializeProgress } from "./partial";

const post = (date: string, title: string, extra = {}) => ({
  date, time: "10:00", dateIsSuggested: false, channel: "Instagram", format: "carousel",
  title, copyText: "", media: [], notes: null, source: "plano.pdf, p. 1", ...extra,
});

describe("posts read from the streamed proposal", () => {
  const full = JSON.stringify({
    summary: 'O arquivo cita "posts": [ e { } no meio do texto.',
    posts: [post("2026-11-03", "Primeiro"), post("2026-11-05", 'Com "aspas" e } chave', { time: null }), post("2026-11-13", "Terceiro")],
    warnings: ["Nada"],
  });

  it("returns every post once the text is complete", () => {
    expect(extractPartialPosts(full).map((p) => p.title)).toEqual(["Primeiro", 'Com "aspas" e } chave', "Terceiro"]);
    expect(extractPartialPosts(full)[1].time).toBeNull();
  });

  it("returns only finished objects at any cut point and never throws", () => {
    let previous = 0;
    for (let cut = 0; cut <= full.length; cut++) {
      const found = extractPartialPosts(full.slice(0, cut));
      expect(found.length).toBeGreaterThanOrEqual(previous);
      expect(found.length).toBeLessThanOrEqual(3);
      previous = found.length;
    }
    expect(previous).toBe(3);
    const firstEnd = full.indexOf("Primeiro");
    expect(extractPartialPosts(full.slice(0, firstEnd))).toEqual([]);
  });

  it("ignores a posts key that is not at the root and objects with an invalid date", () => {
    expect(extractPartialPosts(JSON.stringify({ summary: "x", meta: { posts: [post("2026-11-03", "Aninhado")] } }))).toEqual([]);
    expect(extractPartialPosts(JSON.stringify({ posts: [post("03/11", "Data ruim"), post("2026-11-04", "Ok")] })).map((p) => p.title)).toEqual(["Ok"]);
  });

  it("round-trips the stored progress and rejects a finished proposal", () => {
    const found = extractPartialPosts(full);
    expect(parseProgress(JSON.parse(serializeProgress(found)))).toEqual(found);
    expect(parseProgress(JSON.parse(full))).toEqual([]);
    expect(parseProgress(null)).toEqual([]);
  });
});
