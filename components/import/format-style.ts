import { isBrazilianLocale, type AppLocale } from "@/lib/locale";

/** One color per format, the same on the progress calendar, the review and its mini calendar. */
const STYLES: Record<string, { chip: string; dot: string }> = {
  reels: { chip: "bg-teal-100 text-teal-900 dark:bg-teal-950 dark:text-teal-200", dot: "bg-teal-600 dark:bg-teal-400" },
  video: { chip: "bg-cyan-100 text-cyan-900 dark:bg-cyan-950 dark:text-cyan-200", dot: "bg-cyan-600 dark:bg-cyan-400" },
  carousel: { chip: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200", dot: "bg-amber-600 dark:bg-amber-400" },
  feed: { chip: "bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200", dot: "bg-violet-600 dark:bg-violet-400" },
  stories: { chip: "bg-pink-100 text-pink-900 dark:bg-pink-950 dark:text-pink-200", dot: "bg-pink-600 dark:bg-pink-400" },
  article: { chip: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200", dot: "bg-sky-600 dark:bg-sky-400" },
};

const OTHER = {
  chip: "border border-dashed border-muted-foreground/70 bg-background text-muted-foreground",
  dot: "border border-dashed border-muted-foreground bg-transparent",
};

export function formatStyle(format: string) {
  return STYLES[format] ?? OTHER;
}

/** "10h" / "10h30" in Portuguese, "10:00" in English. */
export function timeLabel(time: string, locale: AppLocale) {
  if (!/^\d{2}:\d{2}$/.test(time)) return time;
  if (!isBrazilianLocale(locale)) return time;
  const [hours, minutes] = time.split(":");
  return `${Number(hours)}h${minutes === "00" ? "" : minutes}`;
}

export function monthLabel(monthKey: string, locale: AppLocale, withYear = false) {
  const label = new Date(`${monthKey}-15T12:00:00Z`).toLocaleDateString(locale, {
    month: "long",
    ...(withYear && { year: "numeric" }),
    timeZone: "UTC",
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function weekdayShort(date: string, locale: AppLocale) {
  return new Date(`${date}T12:00:00Z`)
    .toLocaleDateString(locale, { weekday: "short", timeZone: "UTC" })
    .replace(".", "")
    .toLowerCase();
}

export function weekdayInitials(locale: AppLocale) {
  return isBrazilianLocale(locale) ? ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"] : ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
}
