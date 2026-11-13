"use client";

import { useEffect, useMemo, useRef } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { importFormatLabel, type ImportFormat } from "@/lib/import/proposal";
import { assignPieces, dayKey, monthCells } from "@/lib/import/pieces";
import type { ImportProgressPost } from "@/lib/import/partial";
import { formatStyle, monthLabel, weekdayInitials } from "./format-style";

interface FoundPiece {
  id: string;
  date: string;
  format: string;
  title: string;
  channels: string[];
}

function toPieces(posts: ImportProgressPost[]): FoundPiece[] {
  const ids = assignPieces(posts);
  const pieces = new Map<string, FoundPiece>();
  posts.forEach((post, index) => {
    const piece = pieces.get(ids[index]);
    if (piece) piece.channels.push(post.channel);
    else pieces.set(ids[index], { id: ids[index], date: post.date, format: post.format, title: post.title, channels: [post.channel] });
  });
  return [...pieces.values()];
}

/** While the AI reads: the calendar fills in with each post as soon as it is identified. */
export function ImportProgress({ posts, fileNames }: { posts: ImportProgressPost[]; fileNames: string[] }) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const pieces = useMemo(() => toPieces(posts), [posts]);
  const months = useMemo(() => [...new Set(pieces.map((piece) => piece.date.slice(0, 7)))].sort(), [pieces]);
  const latest = pieces.slice(-3).reverse();
  const latestMonth = pieces.at(-1)?.date.slice(0, 7);
  const monthRefs = useRef(new Map<string, HTMLElement>());

  // Follow the reading: bring the month that just received a post into view.
  useEffect(() => {
    if (!latestMonth) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    monthRefs.current.get(latestMonth)?.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [latestMonth, pieces.length]);

  const byDay = new Map<string, FoundPiece[]>();
  for (const piece of pieces) byDay.set(piece.date, [...(byDay.get(piece.date) ?? []), piece]);

  const label = (format: string) => importFormatLabel(format as ImportFormat, locale);
  // No month known yet: an empty grid of the current month keeps the layout from jumping.
  const shownMonths = months.length ? months : [new Date().toISOString().slice(0, 7)];

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-wrap items-start gap-10 px-6 py-10 sm:px-10">
      <div className="flex min-w-0 flex-[1_1_300px] flex-col gap-6 lg:sticky lg:top-10 lg:max-w-sm">
        <div className="space-y-1.5">
          <h1 className="text-balance font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {tr("Montando o calendário", "Building the calendar")}
          </h1>
          <p className="text-muted-foreground">{tr("Leva cerca de um minuto.", "It takes about a minute.")}</p>
        </div>

        <ol className="space-y-1">
          <li className="flex min-h-11 items-center gap-3">
            <span aria-hidden="true" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-white">
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
            <span className="min-w-0 break-words">
              {fileNames.length === 1
                ? tr("Arquivo recebido", "File received")
                : tr(`${fileNames.length} arquivos recebidos`, `${fileNames.length} files received`)}
            </span>
          </li>
          <li className="flex min-h-11 items-center gap-3">
            <span aria-hidden="true" className="h-6 w-6 shrink-0 animate-spin rounded-full border-[3px] border-brand/25 border-t-brand motion-reduce:animate-none" />
            <span className="font-semibold">{tr("Lendo datas, canais e formatos", "Reading dates, channels and formats")}</span>
          </li>
          <li className="flex min-h-11 items-center gap-3 text-muted-foreground">
            <span aria-hidden="true" className="h-6 w-6 shrink-0 rounded-full border-[1.5px] border-muted-foreground/60" />
            <span>{tr("Preparando a conferência", "Preparing the review")}</span>
          </li>
        </ol>

        <div className="rounded-2xl border bg-card p-4" aria-live="polite">
          {posts.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {tr(
                "Lendo o arquivo inteiro. As primeiras datas aparecem no calendário em instantes.",
                "Reading the whole file. The first dates show up on the calendar in a moment."
              )}
            </p>
          ) : (
            <>
              <p className="font-display text-4xl font-semibold tabular-nums leading-none">{posts.length}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {posts.length === 1
                  ? tr("publicação encontrada até agora", "post found so far")
                  : tr("publicações encontradas até agora", "posts found so far")}
              </p>
            </>
          )}
          {latest.length > 0 && (
            <ul className="mt-3 space-y-1.5 border-t pt-3 text-sm">
              {latest.map((piece) => (
                <li key={piece.id} className="flex items-baseline gap-2 animate-in fade-in slide-in-from-bottom-1 duration-500 motion-reduce:animate-none">
                  <span className="shrink-0 tabular-nums text-muted-foreground">
                    {piece.date.slice(8, 10)}/{piece.date.slice(5, 7)}
                  </span>
                  <span className="min-w-0 truncate" title={piece.title}>{piece.title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-sm text-muted-foreground">
          {tr(
            "Pode fechar esta tela. O calendário fica esperando por você aqui.",
            "You can close this screen. The calendar will be waiting for you here."
          )}
        </p>
      </div>

      <div className="flex min-w-0 flex-[2_1_480px] flex-col gap-5">
        {shownMonths.map((month) => (
          <section
            key={month}
            ref={(node) => {
              if (node) monthRefs.current.set(month, node);
              else monthRefs.current.delete(month);
            }}
            aria-label={monthLabel(month, locale, true)}
            className="scroll-mt-6 rounded-3xl border bg-card p-5 animate-in fade-in slide-in-from-bottom-2 duration-500 motion-reduce:animate-none"
          >
            <div className="mb-3 flex items-baseline justify-between gap-3">
              <h2 className="font-display text-xl font-semibold">{monthLabel(month, locale, true)}</h2>
              <span className="text-sm tabular-nums text-muted-foreground">
                {(() => {
                  const count = pieces.filter((piece) => piece.date.startsWith(month)).length;
                  return count === 1 ? tr("1 peça", "1 piece") : tr(`${count} peças`, `${count} pieces`);
                })()}
              </span>
            </div>
            <div className="overflow-x-auto">
              <div className="grid min-w-[560px] grid-cols-7 gap-1.5">
                {weekdayInitials(locale).map((day) => (
                  <div key={day} className="px-1 pb-0.5 text-xs font-semibold text-muted-foreground">{day}</div>
                ))}
                {monthCells(month).map((day, index) => {
                  if (!day) return <div key={`blank-${index}`} />;
                  const found = byDay.get(dayKey(month, day)) ?? [];
                  return (
                    <div key={day} className={cn("flex min-h-[76px] flex-col gap-1 rounded-xl p-1.5", found.length ? "bg-muted" : "bg-muted/50")}>
                      <span className={cn("text-xs font-semibold tabular-nums", found.length ? "text-foreground" : "text-muted-foreground")}>{day}</span>
                      {found.slice(0, 2).map((piece) => (
                        <span
                          key={piece.id}
                          title={`${piece.title} · ${piece.channels.join(" + ")}`}
                          className={cn(
                            "block truncate rounded-md px-1.5 py-0.5 text-[11px] font-semibold leading-tight animate-in fade-in zoom-in-75 duration-500 motion-reduce:animate-none",
                            formatStyle(piece.format).chip
                          )}
                        >
                          {label(piece.format)}
                        </span>
                      ))}
                      {found.length > 2 && <span className="text-[11px] font-semibold text-muted-foreground">+{found.length - 2}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
        {months.length === 0 && (
          <p className="text-center text-sm text-muted-foreground">
            {tr("As publicações aparecem aqui assim que a IA encontra cada data.", "Posts show up here as soon as the AI finds each date.")}
          </p>
        )}
      </div>
    </div>
  );
}
