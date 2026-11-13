import { describe, expect, it } from "vitest";
import { assignPieces, groupPieces, monthCells, monthsOf, type PieceDraft } from "./pieces";

const draft = (key: string, piece: string, scheduledLocal: string, channel: string, extra: Partial<PieceDraft> = {}): PieceDraft => ({
  key, piece, include: true, scheduledLocal, channel, format: "carousel", title: "T", copyText: "", media: [], textOnly: false, ...extra,
});

describe("pieces: one row per content, one post per channel", () => {
  it("joins channels of the same content and keeps repeated lines apart", () => {
    const item = { date: "2026-11-03", title: "Chuvas" };
    expect(assignPieces([
      { ...item, channel: "Instagram" },
      { ...item, channel: "LinkedIn" },
      { ...item, channel: "Instagram" },
      { ...item, channel: "LinkedIn", title: "Chuvas " },
      { ...item, channel: "Instagram", date: "2026-11-04" },
      { ...item, channel: "Instagram", copyText: "outra legenda" },
    ])).toEqual(["p0", "p0", "p1", "p1", "p2", "p3"]);
  });

  it("orders pieces by date and time and keeps a piece while one channel is selected", () => {
    const pieces = groupPieces([
      draft("2", "b", "2026-11-05T10:00", "Instagram"),
      draft("0", "a", "2026-11-03T10:00", "Instagram", { include: false }),
      draft("1", "a", "2026-11-03T09:00", "LinkedIn"),
      draft("3", "c", "2026-11-03T08:00", "Instagram", { include: false }),
    ]);
    expect(pieces.map((piece) => [piece.id, piece.include, piece.drafts.map((d) => d.channel)])).toEqual([
      ["c", false, ["Instagram"]],
      ["a", true, ["LinkedIn", "Instagram"]],
      ["b", true, ["Instagram"]],
    ]);
    expect(monthsOf([...pieces, { date: "2027-01-07" }])).toEqual([{ key: "2026-11", count: 3 }, { key: "2027-01", count: 1 }]);
  });

  it("lays out month grids from Sunday", () => {
    expect(monthCells("2026-11").slice(0, 3)).toEqual([1, 2, 3]);
    expect(monthCells("2026-11")).toHaveLength(30);
    expect(monthCells("2026-12").slice(0, 3)).toEqual([null, null, 1]);
    expect(monthCells("2027-01").filter((cell) => cell === null)).toHaveLength(5);
  });
});
