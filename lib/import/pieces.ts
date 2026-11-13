import type { ImportFormat } from "./proposal";

/**
 * Review groups the same content going to several channels into one "piece": one row on screen,
 * still one post per channel when created. Pure rules, shared by the review and progress screens.
 */

export interface PieceDraft {
  key: string;
  piece: string;
  include: boolean;
  scheduledLocal: string;
  timeConfirmed: boolean;
  channel: string;
  format: ImportFormat;
  title: string;
  copyText: string;
  media: string[];
  textOnly: boolean;
}

type Groupable = { date: string; channel: string; title: string; copyText?: string; media?: string[] };

/**
 * Piece id for each item, in order. Same date, title, caption and media = same piece, unless the
 * channel repeats: a repeated line in the source stays a separate row for the person to decide.
 * Format is not part of it: the same video is "Reels" on Instagram and "Video" on LinkedIn.
 */
export function assignPieces(items: Groupable[]): string[] {
  const open = new Map<string, { id: string; channels: Set<string> }[]>();
  let next = 0;
  return items.map((item) => {
    const fingerprint = JSON.stringify([item.date, item.title.trim(), item.copyText ?? "", item.media ?? []]);
    const groups = open.get(fingerprint) ?? [];
    open.set(fingerprint, groups);
    let group = groups.find((candidate) => !candidate.channels.has(item.channel));
    if (!group) {
      group = { id: `p${next++}`, channels: new Set() };
      groups.push(group);
    }
    group.channels.add(item.channel);
    return group.id;
  });
}

export interface Piece<T extends PieceDraft = PieceDraft> {
  id: string;
  drafts: T[];
  /** YYYY-MM-DD shared by the piece. */
  date: string;
  include: boolean;
}

export function groupPieces<T extends PieceDraft>(drafts: T[]): Piece<T>[] {
  const byId = new Map<string, T[]>();
  for (const draft of drafts) byId.set(draft.piece, [...(byId.get(draft.piece) ?? []), draft]);
  return [...byId.entries()]
    .map(([id, group]) => ({
      id,
      drafts: [...group].sort((a, b) => a.scheduledLocal.localeCompare(b.scheduledLocal) || a.channel.localeCompare(b.channel)),
      date: group[0].scheduledLocal.slice(0, 10),
      include: group.some((draft) => draft.include),
    }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.drafts[0].scheduledLocal.localeCompare(b.drafts[0].scheduledLocal));
}

/**
 * Times to offer for posts whose source has no time: the most used times among the posts that do
 * have one, preferring the same channels as the posts still waiting.
 */
export function suggestedTimes(drafts: PieceDraft[], limit = 2): string[] {
  const selected = drafts.filter((draft) => draft.include);
  const waitingChannels = new Set(selected.filter((draft) => !draft.timeConfirmed).map((draft) => draft.channel));
  const timed = selected.filter((draft) => draft.timeConfirmed);
  const rank = (pool: PieceDraft[]) => {
    const count = new Map<string, number>();
    for (const draft of pool) {
      const time = draft.scheduledLocal.slice(11, 16);
      if (/^\d{2}:\d{2}$/.test(time)) count.set(time, (count.get(time) ?? 0) + 1);
    }
    return [...count.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([time]) => time);
  };
  const sameChannel = rank(timed.filter((draft) => waitingChannels.has(draft.channel)));
  const ranked = sameChannel.length ? sameChannel : rank(timed);
  return ranked.slice(0, limit).sort();
}

/** Sets one time on every selected post still waiting for a decision. */
export function applyTimeToWaiting<T extends PieceDraft>(drafts: T[], time: string): T[] {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return drafts;
  return drafts.map((draft) =>
    draft.include && !draft.timeConfirmed
      ? { ...draft, scheduledLocal: `${draft.scheduledLocal.slice(0, 10)}T${time}`, timeConfirmed: true }
      : draft
  );
}

/** YYYY-MM keys that have at least one piece, in order, with their piece counts. */
export function monthsOf(pieces: Pick<Piece, "date">[]): { key: string; count: number }[] {
  const count = new Map<string, number>();
  for (const piece of pieces) count.set(piece.date.slice(0, 7), (count.get(piece.date.slice(0, 7)) ?? 0) + 1);
  return [...count.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([key, total]) => ({ key, count: total }));
}

/** Cells of a month grid starting on Sunday: null before day 1, then 1..N. */
export function monthCells(monthKey: string): (number | null)[] {
  const [year, month] = monthKey.split("-").map(Number);
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return [...Array<null>(first).fill(null), ...Array.from({ length: days }, (_, index) => index + 1)];
}

export function dayKey(monthKey: string, day: number) {
  return `${monthKey}-${String(day).padStart(2, "0")}`;
}
