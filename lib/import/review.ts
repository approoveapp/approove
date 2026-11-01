import { isBrazilianLocale, type AppLocale } from "@/lib/locale";

/** Shared review rules. No browser timezone assumptions or server dependencies. */
export const DEFAULT_IMPORT_TIMEZONE = "America/Sao_Paulo";
export const IMPORT_TIMEZONES = ["America/Sao_Paulo", "America/Manaus", "America/Recife", "Europe/Lisbon", "UTC"];

/** Resolve wall-clock time in an explicit IANA zone; reject invalid/calendar-gap dates. */
export function importDateTimeToIso(local: string, timeZone: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(local)) return null;
  const wall = Date.parse(`${local}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 16) !== local) return null;
  try {
    const formatter = new Intl.DateTimeFormat("sv-SE", {
      timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
    });
    const format = (value: number) => formatter.format(new Date(value)).replace(" ", "T");
    let instant = wall;
    for (let i = 0; i < 3; i++) {
      const offset = Date.parse(`${format(instant)}:00Z`) - instant;
      instant = wall - offset;
    }
    // A DST gap has no matching instant. An overlap needs explicit review, too.
    if (format(instant) !== local) return null;
    if (format(instant - 3600000) === local || format(instant + 3600000) === local) return null;
    return new Date(instant).toISOString();
  } catch { return null; }
}

export function repeatedMediaNames(names: string[]) {
  const seen = new Set<string>();
  return [...new Set(names.filter(name => { const exists = seen.has(name); seen.add(name); return exists; }))];
}

export function duplicatePostKeys(posts: { key: string; scheduledLocal: string; channel: string; copyText: string; title: string }[]) {
  const seen = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const post of posts) {
    const fingerprint = JSON.stringify([post.scheduledLocal, post.channel, post.title.trim(), post.copyText]);
    const prior = seen.get(fingerprint);
    if (prior !== undefined) { duplicates.add(prior); duplicates.add(post.key); }
    else seen.set(fingerprint, post.key);
  }
  return duplicates;
}

/** Counts reflect the edited selection, never the model's narrative summary. */
export function reviewSummary(posts: { include: boolean; scheduledLocal: string; copyText: string; media: string[] }[], locale: AppLocale) {
  const selected = posts.filter(post => post.include);
  const dates = selected.map(post => post.scheduledLocal.slice(0, 10)).filter(date => /^\d{4}-\d{2}-\d{2}$/.test(date)).sort();
  const withCopy = selected.filter(post => post.copyText.trim()).length;
  const withMedia = selected.filter(post => post.media.length).length;
  if (!isBrazilianLocale(locale)) {
    const range = dates.length ? ` Selected period: ${dates[0]} to ${dates.at(-1)}.` : "";
    return `${posts.length} proposed; ${selected.length} selected. ${withCopy} with caption; ${withMedia} with media.${range}`;
  }
  const range = dates.length ? ` Período selecionado: ${dates[0]} a ${dates.at(-1)}.` : "";
  return `${posts.length} propostas; ${selected.length} selecionadas. ${withCopy} com legenda; ${withMedia} com mídia.${range}`;
}

export function hasSourceTime(time: string | null) {
  return !!time && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
}

export function unconfirmedTimeCount(posts: { include: boolean; timeConfirmed: boolean }[]) {
  return posts.filter(post => post.include && !post.timeConfirmed).length;
}
