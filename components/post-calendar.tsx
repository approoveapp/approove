"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { dayKey, monthCells } from "@/lib/import/pieces";
import { monthLabel, timeLabel, weekdayInitials } from "@/components/import/format-style";

export interface CalendarPost {
  id: string;
  scheduledAt: string;
  channel: string;
  title: string;
  status: string;
  hasArt: boolean;
}

const DAY_LIMIT = 3;

function localDay(iso: string) {
  const date = new Date(iso);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function localTime(iso: string) {
  const date = new Date(iso);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function shiftMonth(monthKey: string, by: number) {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1 + by, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Month grid with one chip per post: channel, time, title and whether the creative is still missing. */
export function PostCalendar({
  posts,
  focusDate,
  channelClass,
  onPostClick,
  onEmptyDateClick,
}: {
  posts: CalendarPost[];
  /** YYYY-MM-DD to bring into view, e.g. the first post of an import. */
  focusDate?: string | null;
  channelClass: (channel: string) => string;
  onPostClick: (id: string) => void;
  onEmptyDateClick: (dateKey: string) => void;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const today = localDay(new Date().toISOString());
  const [month, setMonth] = useState(() => {
    if (focusDate) return focusDate.slice(0, 7);
    const days = posts.map((post) => localDay(post.scheduledAt)).sort();
    // The month where work continues: the next post from today, else the last one planned.
    return (days.find((day) => day >= today) ?? days.at(-1) ?? today).slice(0, 7);
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (focusDate) setMonth(focusDate.slice(0, 7));
  }, [focusDate]);

  const byDay = new Map<string, CalendarPost[]>();
  for (const post of [...posts].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))) {
    const key = localDay(post.scheduledAt);
    byDay.set(key, [...(byDay.get(key) ?? []), post]);
  }
  const monthCount = [...byDay.entries()].filter(([key]) => key.startsWith(month)).reduce((sum, [, list]) => sum + list.length, 0);

  return (
    <div className="space-y-3.5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5">
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setMonth(shiftMonth(month, -1))} aria-label={tr("Mês anterior", "Previous month")}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h3 className="mx-2 min-w-[11rem] text-center font-display text-xl font-semibold sm:text-[22px]">{monthLabel(month, locale, true)}</h3>
          <Button type="button" variant="outline" size="icon" className="h-11 w-11 rounded-xl" onClick={() => setMonth(shiftMonth(month, 1))} aria-label={tr("Próximo mês", "Next month")}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-3 text-sm text-muted-foreground">
          <span className="tabular-nums">
            {monthCount === 1 ? tr("1 publicação", "1 post") : tr(`${monthCount} publicações`, `${monthCount} posts`)}
          </span>
          {month !== today.slice(0, 7) && (
            <button type="button" onClick={() => setMonth(today.slice(0, 7))} className="font-semibold text-foreground underline underline-offset-2">
              {tr("Hoje", "Today")}
            </button>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-1.5">
          {weekdayInitials(locale).map((day) => (
            <div key={day} className="px-2 pb-0.5 text-xs font-semibold capitalize text-muted-foreground">{day}</div>
          ))}
          {monthCells(month).map((day, index) => {
            if (!day) return <div key={`blank-${index}`} />;
            const key = dayKey(month, day);
            const dayPosts = byDay.get(key) ?? [];
            const open = expanded === key;
            const shown = open ? dayPosts : dayPosts.slice(0, DAY_LIMIT);
            return (
              <div
                key={key}
                className={cn(
                  "group flex min-h-[124px] flex-col gap-1.5 rounded-xl border-2 border-transparent bg-muted/60 p-1.5",
                  key === today && "border-foreground"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn("px-0.5 text-[13px] font-semibold tabular-nums", dayPosts.length || key === today ? "text-foreground" : "text-muted-foreground")}>{day}</span>
                  <button
                    type="button"
                    onClick={() => onEmptyDateClick(key)}
                    aria-label={tr(`Nova publicação em ${day}`, `New post on day ${day}`)}
                    className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-opacity hover:bg-background focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                </div>
                {shown.map((post) => (
                  <button
                    key={post.id}
                    type="button"
                    onClick={() => onPostClick(post.id)}
                    className="relative flex w-full flex-col gap-1 rounded-lg border bg-card p-1.5 text-left shadow-sm transition-shadow hover:shadow-md"
                  >
                    <span className="flex items-center gap-1 text-[11px] font-semibold tabular-nums">
                      <span className={cn("rounded px-1 py-px", channelClass(post.channel))}>{post.channel}</span>
                      <span className="text-muted-foreground">{timeLabel(localTime(post.scheduledAt), locale)}</span>
                      {post.status !== "pending" && (
                        <span
                          aria-label={post.status === "approved" ? tr("Aprovada", "Approved") : tr("Com ajustes", "Changes requested")}
                          role="img"
                          className={cn("h-2 w-2 rounded-full", post.status === "approved" ? "bg-emerald-500" : "bg-orange-500")}
                        />
                      )}
                    </span>
                    {/* No canto, fora do fluxo: o nome do canal e o horário nunca disputam espaço com o selo. */}
                    {!post.hasArt && (
                      <span
                        role="img"
                        aria-label={tr("Sem arte ainda", "No creative yet")}
                        title={tr("Sem arte ainda", "No creative yet")}
                        className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-md border border-dashed border-muted-foreground bg-card text-muted-foreground"
                      >
                        <ImagePlus aria-hidden="true" className="h-3 w-3" />
                      </span>
                    )}
                    <span className="line-clamp-2 text-xs font-semibold leading-snug">{post.title || tr("Sem título", "Untitled")}</span>
                  </button>
                ))}
                {dayPosts.length > DAY_LIMIT && (
                  <button type="button" onClick={() => setExpanded(open ? null : key)} className="self-start px-1 text-[11px] font-semibold text-muted-foreground underline underline-offset-2">
                    {open ? tr("Mostrar menos", "Show less") : tr(`+${dayPosts.length - DAY_LIMIT} mais`, `+${dayPosts.length - DAY_LIMIT} more`)}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
