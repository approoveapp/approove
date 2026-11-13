"use client";

import { useMemo, useState } from "react";
import { Film, Pencil, Undo2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import {
  IMPORT_CHANNELS,
  IMPORT_FORMATS,
  importFormatLabel,
  unusedMediaNames,
  type ImportFormat,
  type ImportProposalPost,
} from "@/lib/import/proposal";
import { duplicatePostKeys, IMPORT_TIMEZONES } from "@/lib/import/review";
import {
  dayKey,
  groupPieces,
  monthCells,
  monthsOf,
  type Piece,
  type PieceDraft,
} from "@/lib/import/pieces";
import type { SerializedImportJob } from "@/lib/import/jobs";
import { formatStyle, monthLabel, timeLabel, weekdayInitials, weekdayShort } from "./format-style";

export interface ImportDraft extends PieceDraft {
  source: ImportProposalPost;
}

const NOTES_PREVIEW = 4;

/** Review before creating: one row per piece, details on demand. Nothing is asked of the person. */
export function ImportReview({
  job,
  drafts,
  onChange,
  timeZone,
  onTimeZone,
}: {
  job: SerializedImportJob;
  drafts: ImportDraft[];
  onChange: (update: (previous: ImportDraft[]) => ImportDraft[]) => void;
  timeZone: string;
  onTimeZone: (zone: string) => void;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [monthChoice, setMonthChoice] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showAllNotes, setShowAllNotes] = useState(false);

  const pieces = useMemo(() => groupPieces(drafts), [drafts]);
  const months = useMemo(() => monthsOf(pieces), [pieces]);
  const month = months.some((item) => item.key === monthChoice) ? monthChoice! : months[0]?.key;

  const selected = drafts.filter((draft) => draft.include);
  const includedPieces = pieces.filter((piece) => piece.include);
  const duplicateKeys = duplicatePostKeys(selected);
  const unusedMedia = unusedMediaNames(job.media, selected);
  const mediaByName = new Map(job.media.map((item) => [item.name, item]));
  const notes = job.proposal?.warnings ?? [];
  const visibleNotes = showAllNotes || notes.length <= NOTES_PREVIEW + 1 ? notes : notes.slice(0, NOTES_PREVIEW);

  const channelCounts = IMPORT_CHANNELS.map((channel) => [channel, selected.filter((draft) => draft.channel === channel).length] as const).filter(
    ([, count]) => count > 0
  );
  const channelSentence = channelCounts.map(([channel, count]) => tr(`${count} no ${channel}`, `${count} on ${channel}`));
  const joined =
    channelSentence.length > 1
      ? `${channelSentence.slice(0, -1).join(", ")} ${tr("e", "and")} ${channelSentence.at(-1)}`
      : channelSentence[0] ?? "";

  const updateDraft = (key: string, patch: Partial<ImportDraft>) =>
    onChange((previous) => previous.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));
  const updatePiece = (id: string, patch: (draft: ImportDraft) => Partial<ImportDraft>) =>
    onChange((previous) => previous.map((draft) => (draft.piece === id ? { ...draft, ...patch(draft) } : draft)));

  if (drafts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-xl px-6 py-24 text-center">
        <h1 className="font-display text-3xl font-semibold">{tr("Nenhuma publicação encontrada", "No posts found")}</h1>
        <p className="mt-2 text-muted-foreground">
          {tr(
            "A IA não achou datas de publicação nesses arquivos. Descarte e envie o planejamento do mês.",
            "The AI found no post dates in these files. Discard and upload the month's plan."
          )}
        </p>
      </div>
    );
  }

  const monthPieces = pieces.filter((piece) => piece.date.startsWith(month ?? ""));
  const byDay = new Map<string, Piece<ImportDraft>[]>();
  for (const piece of monthPieces) if (piece.include) byDay.set(piece.date, [...(byDay.get(piece.date) ?? []), piece]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-5 px-5 py-8 sm:px-8">
      <div className="space-y-1">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {includedPieces.length === 1 ? tr("1 peça", "1 piece") : tr(`${includedPieces.length} peças`, `${includedPieces.length} pieces`)}{" "}
          {months.length === 1 ? tr("em 1 mês", "in 1 month") : tr(`em ${months.length} meses`, `across ${months.length} months`)}
        </h1>
        <p className="text-muted-foreground" aria-live="polite">
          {selected.length === 1
            ? tr("Vira 1 publicação", "Becomes 1 post")
            : tr(`Viram ${selected.length} publicações`, `Become ${selected.length} posts`)}
          {joined && `: ${joined}`}.
        </p>
      </div>

      {duplicateKeys.size > 0 && (
        <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-5 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          {tr(
            `${duplicateKeys.size} publicações parecem repetidas. Elas estão marcadas na lista: tire as que não quer criar.`,
            `${duplicateKeys.size} posts look repeated. They are marked in the list: remove the ones you do not want to create.`
          )}
        </p>
      )}

      <div className="flex flex-wrap items-start gap-6">
        <aside className="order-2 flex min-w-0 flex-[1_1_260px] flex-col gap-4 lg:order-1 lg:max-w-xs">
          {month && (
            <section aria-label={monthLabel(month, locale, true)} className="rounded-2xl border bg-card p-4">
              <h2 className="mb-3 font-display text-lg font-semibold">{monthLabel(month, locale, true)}</h2>
              <div className="grid grid-cols-7 gap-1 text-center">
                {weekdayInitials(locale).map((day) => (
                  <span key={day} className="text-[11px] font-semibold uppercase text-muted-foreground">{day.charAt(0)}</span>
                ))}
                {monthCells(month).map((day, index) => {
                  if (!day) return <span key={`blank-${index}`} />;
                  const found = byDay.get(dayKey(month, day)) ?? [];
                  return (
                    <span
                      key={day}
                      className={cn(
                        "flex h-9 flex-col items-center justify-center gap-0.5 text-xs tabular-nums",
                        found.length ? "font-semibold text-foreground" : "text-muted-foreground"
                      )}
                    >
                      {day}
                      <span aria-hidden="true" className="flex h-2 gap-0.5">
                        {found.slice(0, 3).map((piece) => (
                          <span key={piece.id} className={cn("h-2 w-2 rounded-full", formatStyle(piece.drafts[0].format).dot)} />
                        ))}
                      </span>
                    </span>
                  );
                })}
              </div>
              <ul aria-label={tr("Legenda de cores", "Color key")} className="mt-3 flex flex-wrap gap-x-3.5 gap-y-1.5 border-t pt-3 text-xs text-muted-foreground">
                {[...new Set(selected.map((draft) => draft.format))].map((format) => (
                  <li key={format} className="flex items-center gap-1.5">
                    <span aria-hidden="true" className={cn("h-2 w-2 rounded-full", formatStyle(format).dot)} />
                    {importFormatLabel(format, locale)}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {notes.length > 0 && (
            <section aria-label={tr("A IA notou", "The AI noticed")} className="rounded-2xl border bg-card p-4">
              <h2 className="mb-2 font-display text-lg font-semibold">{tr("A IA notou", "The AI noticed")}</h2>
              <ul className="list-disc space-y-2 pl-4 text-sm text-muted-foreground">
                {visibleNotes.map((note, index) => (
                  <li key={index}>{note}</li>
                ))}
              </ul>
              {notes.length > NOTES_PREVIEW + 1 && (
                <button
                  type="button"
                  aria-expanded={showAllNotes}
                  onClick={() => setShowAllNotes((value) => !value)}
                  className="mt-2 text-sm font-semibold underline underline-offset-2"
                >
                  {showAllNotes ? tr("Mostrar menos", "Show less") : tr(`Ver as ${notes.length} observações`, `See all ${notes.length} notes`)}
                </button>
              )}
            </section>
          )}

          {unusedMedia.length > 0 && (
            <section className="rounded-2xl border border-dashed bg-card p-4 text-sm">
              <h2 className="mb-1 font-semibold">
                {unusedMedia.length === 1 ? tr("1 arte sem publicação", "1 creative without a post") : tr(`${unusedMedia.length} artes sem publicação`, `${unusedMedia.length} creatives without a post`)}
              </h2>
              <p className="break-words text-muted-foreground">{unusedMedia.join(", ")}</p>
            </section>
          )}

          <label className="flex flex-wrap items-center gap-2 px-1 text-sm text-muted-foreground">
            {tr("Horários no fuso", "Times in time zone")}
            <select
              aria-label={tr("Fuso dos horários", "Time zone")}
              value={timeZone}
              onChange={(event) => onTimeZone(event.target.value)}
              className="h-9 rounded-md border bg-background px-2 text-foreground"
            >
              {IMPORT_TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </label>
        </aside>

        <section aria-label={tr("Peças do mês", "Pieces of the month")} className="order-1 flex min-w-0 flex-[3_1_480px] flex-col gap-3 lg:order-2">
          <div role="group" aria-label={tr("Mês", "Month")} className="flex flex-wrap gap-1 self-start rounded-2xl bg-muted p-1">
            {months.map((item) => (
              <button
                key={item.key}
                type="button"
                aria-pressed={item.key === month}
                onClick={() => {
                  setMonthChoice(item.key);
                  setEditing(null);
                }}
                className={cn(
                  "flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors",
                  item.key === month ? "bg-foreground text-background" : "text-foreground hover:bg-background/70"
                )}
              >
                {monthLabel(item.key, locale)}
                <span className="font-medium tabular-nums opacity-80">{item.count}</span>
              </button>
            ))}
          </div>

          <ul className="flex flex-col gap-1.5">
            {monthPieces.map((piece) => {
              const head = piece.drafts[0];
              const shown = piece.drafts.filter((draft) => draft.include);
              const duplicate = piece.drafts.some((draft) => duplicateKeys.has(draft.key));
              const open = editing === piece.id;
              return (
                <li
                  key={piece.id}
                  className={cn(
                    "rounded-2xl border bg-card transition-opacity",
                    !piece.include && "opacity-60"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-2 pl-4 pr-2">
                    <div className="flex w-11 shrink-0 flex-col items-center leading-none">
                      <span className="font-display text-2xl font-semibold tabular-nums">{piece.date.slice(8, 10)}</span>
                      <span className="mt-1 text-xs font-semibold text-muted-foreground">{weekdayShort(piece.date, locale)}</span>
                    </div>
                    <div className="min-w-0 flex-[1_1_220px]">
                      <p className={cn("text-pretty font-semibold leading-snug", !piece.include && "line-through")}>
                        {head.title.trim() || tr("Sem título", "Untitled")}
                      </p>
                      {(duplicate || head.source.dateIsSuggested) && (
                        <p className="mt-0.5 text-xs font-semibold text-amber-800 dark:text-amber-300">
                          {[duplicate && tr("Possível repetição", "Possible repeat"), head.source.dateIsSuggested && tr("Data sugerida pela IA", "Date suggested by the AI")]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-none flex-wrap gap-1.5">
                      {[...new Set((shown.length ? shown : piece.drafts).map((draft) => draft.format))].map((format) => (
                        <span key={format} className={cn("rounded-lg px-2.5 py-1 text-[13px] font-semibold", formatStyle(format).chip)}>
                          {importFormatLabel(format, locale)}
                        </span>
                      ))}
                    </div>
                    <div className="flex max-w-full flex-none flex-wrap gap-1.5 text-[13px] font-semibold tabular-nums">
                      {shown.map((draft) => (
                        <span key={draft.key} className="rounded-lg bg-muted px-2.5 py-1 text-foreground">
                          {draft.channel} {timeLabel(draft.scheduledLocal.slice(11, 16), locale)}
                        </span>
                      ))}
                      {!piece.include && <span className="rounded-lg bg-muted px-2.5 py-1 text-muted-foreground">{tr("Fora da importação", "Left out")}</span>}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 text-muted-foreground"
                      aria-expanded={open}
                      aria-label={
                        open
                          ? tr(`Fechar edição de ${head.title || "peça"}`, `Close editing ${head.title || "piece"}`)
                          : tr(`Editar ${head.title || "peça"}`, `Edit ${head.title || "piece"}`)
                      }
                      onClick={() => setEditing(open ? null : piece.id)}
                    >
                      {open ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                    </Button>
                  </div>

                  {open && (
                    <div className="space-y-4 border-t p-4">
                      <div className="flex flex-wrap gap-3">
                        <label className="flex min-w-0 flex-[3_1_260px] flex-col gap-1 text-sm font-medium">
                          {tr("Título", "Title")}
                          <Input value={head.title} maxLength={300} onChange={(event) => updatePiece(piece.id, () => ({ title: event.target.value }))} />
                        </label>
                        <label className="flex flex-col gap-1 text-sm font-medium">
                          {tr("Data", "Date")}
                          <Input
                            type="date"
                            value={piece.date}
                            onChange={(event) => {
                              const date = event.target.value;
                              if (/^\d{4}-\d{2}-\d{2}$/.test(date)) updatePiece(piece.id, (draft) => ({ scheduledLocal: `${date}${draft.scheduledLocal.slice(10)}` }));
                            }}
                            className="w-auto"
                          />
                        </label>
                      </div>

                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">{tr("Canais, formatos e horários", "Channels, formats and times")}</legend>
                        {piece.drafts.map((draft) => (
                          <div key={draft.key} className="flex flex-wrap items-center gap-2">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={draft.include}
                              aria-label={tr(`Criar no ${draft.channel}`, `Create on ${draft.channel}`)}
                              onChange={(event) => updateDraft(draft.key, { include: event.target.checked })}
                            />
                            <select
                              aria-label={tr("Canal", "Channel")}
                              value={draft.channel}
                              onChange={(event) => updateDraft(draft.key, { channel: event.target.value })}
                              className="h-10 rounded-md border bg-background px-2 text-sm"
                            >
                              {IMPORT_CHANNELS.map((channel) => (
                                <option key={channel} value={channel}>{channel}</option>
                              ))}
                            </select>
                            <select
                              aria-label={tr(`Formato no ${draft.channel}`, `Format on ${draft.channel}`)}
                              value={draft.format}
                              onChange={(event) => updateDraft(draft.key, { format: event.target.value as ImportFormat })}
                              className="h-10 rounded-md border bg-background px-2 text-sm"
                            >
                              {IMPORT_FORMATS.map((format) => (
                                <option key={format} value={format}>{importFormatLabel(format, locale)}</option>
                              ))}
                            </select>
                            <Input
                              type="time"
                              aria-label={tr(`Horário no ${draft.channel}`, `Time on ${draft.channel}`)}
                              value={draft.scheduledLocal.slice(11, 16)}
                              onChange={(event) => {
                                if (/^\d{2}:\d{2}$/.test(event.target.value)) {
                                  updateDraft(draft.key, { scheduledLocal: `${draft.scheduledLocal.slice(0, 10)}T${event.target.value}` });
                                }
                              }}
                              className="w-[7.5rem]"
                            />
                          </div>
                        ))}
                      </fieldset>

                      <label className="flex flex-col gap-1 text-sm font-medium">
                        {tr("Legenda", "Caption")}
                        <textarea
                          value={head.copyText}
                          rows={3}
                          maxLength={10000}
                          placeholder={tr("Sem legenda no arquivo. O time escreve depois.", "No caption in the file. The team writes it later.")}
                          onChange={(event) => updatePiece(piece.id, () => ({ copyText: event.target.value }))}
                          className="w-full resize-y rounded-md border bg-background px-3 py-2 text-sm font-normal"
                        />
                      </label>

                      {job.media.length > 0 && (
                        <div className="space-y-2">
                          <p className="text-sm font-medium">{tr("Artes", "Creatives")}</p>
                          {head.media.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {head.media.map((name, index) => {
                                const item = mediaByName.get(name);
                                if (!item) return null;
                                return (
                                  <div key={name} className="relative w-20" title={name}>
                                    <div className="relative h-20 w-20 overflow-hidden rounded-md border bg-muted">
                                      {item.mediaType === "video" ? (
                                        <>
                                          <video src={item.url} muted preload="metadata" className="h-full w-full object-cover" />
                                          <Film className="absolute bottom-1 left-1 h-4 w-4 text-white drop-shadow" />
                                        </>
                                      ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={item.url} alt={name} className="h-full w-full object-cover" />
                                      )}
                                      {head.media.length > 1 && (
                                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1 text-[10px] text-white">{index + 1}</span>
                                      )}
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => updatePiece(piece.id, (draft) => ({ media: draft.media.filter((other) => other !== name) }))}
                                      className="absolute -right-1.5 -top-1.5 rounded-full border bg-background p-0.5 shadow-sm hover:bg-muted"
                                      aria-label={tr(`Tirar ${name} desta peça`, `Remove ${name} from this piece`)}
                                    >
                                      <X className="h-3 w-3" />
                                    </button>
                                    <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{name}</p>
                                    {index > 0 && (
                                      <button
                                        type="button"
                                        className="text-xs underline"
                                        aria-label={tr(`Mover ${name} antes`, `Move ${name} earlier`)}
                                        onClick={() =>
                                          updatePiece(piece.id, (draft) => {
                                            const media = [...draft.media];
                                            const at = media.indexOf(name);
                                            if (at > 0) [media[at - 1], media[at]] = [media[at], media[at - 1]];
                                            return { media };
                                          })
                                        }
                                      >
                                        {tr("Mover antes", "Move earlier")}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {job.media.some((item) => !head.media.includes(item.name)) && (
                            <select
                              aria-label={tr("Adicionar arte enviada", "Add an uploaded creative")}
                              value=""
                              onChange={(event) => {
                                const name = event.target.value;
                                if (name) updatePiece(piece.id, (draft) => ({ media: [...draft.media, name], textOnly: false }));
                              }}
                              className="h-10 max-w-full rounded-md border bg-background px-2 text-sm"
                            >
                              <option value="">{tr("Adicionar arte enviada...", "Add an uploaded creative...")}</option>
                              {job.media.filter((item) => !head.media.includes(item.name)).map((item) => (
                                <option key={item.name} value={item.name}>{item.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}

                      {head.media.length === 0 && (
                        <label className="flex items-center gap-2 text-sm text-muted-foreground">
                          <input
                            type="checkbox"
                            className="h-4 w-4"
                            checked={head.textOnly}
                            onChange={(event) => updatePiece(piece.id, () => ({ textOnly: event.target.checked }))}
                          />
                          {tr("Publicação só de texto (dispensa arte)", "Text-only post (no creative needed)")}
                        </label>
                      )}

                      <div className="flex flex-wrap items-center justify-between gap-2 border-t pt-3">
                        <Button
                          type="button"
                          variant="ghost"
                          className={cn("h-11", piece.include && "text-destructive hover:text-destructive")}
                          onClick={() => updatePiece(piece.id, () => ({ include: !piece.include }))}
                        >
                          {piece.include ? (
                            <><X className="mr-2 h-4 w-4" /> {tr("Tirar da importação", "Leave out of the import")}</>
                          ) : (
                            <><Undo2 className="mr-2 h-4 w-4" /> {tr("Voltar para a importação", "Bring back into the import")}</>
                          )}
                        </Button>
                        <Button type="button" variant="outline" className="h-11" onClick={() => setEditing(null)}>
                          {tr("Pronto", "Done")}
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>
    </div>
  );
}
