"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { AlertTriangle, ArrowRight, Check, ChevronLeft, FileText, Film, ImageIcon, Loader2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { buildImportNote, MAX_IMPORT_MEDIA, proposalLocalDateTime, type ImportMedia, type ImportProposalPost } from "@/lib/import/proposal";
import { DEFAULT_IMPORT_TIMEZONE, hasSourceTime, importDateTimeToIso, repeatedMediaNames, unconfirmedTimeCount } from "@/lib/import/review";
import { assignPieces } from "@/lib/import/pieces";
import type { SerializedImportJob } from "@/lib/import/jobs";
import { ImportProgress } from "./import-progress";
import { ImportReview, type ImportDraft } from "./import-review";

const ACCEPT =
  ".pdf,.docx,.xlsx,.csv,.tsv,.txt,.md,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime";
/** Documentos vão juntos num pedido; cada mídia vai num pedido próprio (teto de 4,5 MB na Vercel). */
const MAX_DOCS_BYTES = 4 * 1024 * 1024;
const MAX_DOCS = 10;
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const MAX_POSTS = 200;
/** Curto o bastante para as publicações aparecerem no calendário enquanto a IA lê. */
const POLL_MS = 1500;

type Phase = "loading" | "upload" | "processing" | "review" | "failed";

interface Quota {
  used: number;
  limit: number | null;
}

export interface ImportFlowProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSlug: string;
  clientName: string;
  /** Files dropped on the client page before the flow opened. */
  initialFiles?: File[];
  /** `firstDate` (YYYY-MM-DD) lets the page open the calendar on the first created post. */
  onImported: (result: { created: number; firstDate: string | null }) => void;
}

function toDrafts(posts: ImportProposalPost[], media: ImportMedia[]): ImportDraft[] {
  const known = new Set(media.map((item) => item.name));
  // Nome que não está entre as mídias enviadas é descartado aqui; o servidor recusaria.
  const cleaned = posts.map((post) => ({ ...post, media: post.media.filter((name) => known.has(name)) }));
  const pieces = assignPieces(cleaned);
  return cleaned.map((post, index) => ({
    key: `${index}`,
    piece: pieces[index],
    include: true,
    scheduledLocal: proposalLocalDateTime(post),
    timeConfirmed: hasSourceTime(post.time),
    channel: post.channel,
    title: post.title,
    copyText: post.copyText,
    format: post.format,
    textOnly: false,
    media: post.media,
    source: posts[index],
  }));
}

function isMediaFile(file: File) {
  return /^(image|video)\//.test(file.type) || /\.(jpe?g|png|gif|webp|mp4|mov)$/i.test(file.name);
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

function Stepper({ current, labels }: { current: number; labels: string[] }) {
  return (
    <ol className="flex flex-wrap items-center gap-2 text-sm font-semibold sm:gap-2.5">
      {labels.map((label, index) => (
        <li key={label} className="flex items-center gap-2 sm:gap-2.5" aria-current={index === current ? "step" : undefined}>
          {index > 0 && <span aria-hidden="true" className={cn("h-0.5 w-5 sm:w-9", index <= current ? "bg-foreground" : "bg-border")} />}
          <span
            aria-hidden="true"
            className={cn(
              "flex h-[26px] w-[26px] items-center justify-center rounded-full text-[13px] tabular-nums",
              index < current && "bg-foreground text-background",
              index === current && "bg-brand text-brand-foreground",
              index > current && "border-[1.5px] border-muted-foreground/60 text-muted-foreground"
            )}
          >
            {index < current ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
          </span>
          <span className={index > current ? "text-muted-foreground" : undefined}>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Full-screen import: upload the plan, watch the calendar fill in, check it, create the posts. */
export function ImportFlow({ open, onOpenChange, clientSlug, clientName, initialFiles, onImported }: ImportFlowProps) {
  const locale = useLocale();
  const tr = useCallback((pt: string, en: string) => localizedText(locale, pt, en), [locale]);
  const docInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const reviewedJobId = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [timeZone, setTimeZone] = useState(DEFAULT_IMPORT_TIMEZONE);
  const [phase, setPhase] = useState<Phase>("loading");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [job, setJob] = useState<SerializedImportJob | null>(null);
  const [drafts, setDrafts] = useState<ImportDraft[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const applyJob = useCallback((next: SerializedImportJob) => {
    setJob(next);
    if (next.status === "processing" || next.status === "committing") {
      setPhase("processing");
    } else if (next.status === "review" && next.proposal) {
      // Fechar e reabrir nesta aba não deve apagar a revisão já feita.
      if (reviewedJobId.current !== next.id) {
        setDrafts(toDrafts(next.proposal.posts, next.media));
        reviewedJobId.current = next.id;
      }
      setPhase("review");
    } else {
      setError(next.error ?? tr("A importação falhou. Tente de novo.", "The import failed. Try again."));
      setPhase("failed");
    }
  }, [tr]);

  const addFiles = useCallback((list: FileList | File[]) => {
    const incoming = Array.from(list).filter((file) => file.size > 0);
    setFiles((previous) => {
      const names = new Set(previous.map((file) => `${file.name}:${file.size}`));
      return [...previous, ...incoming.filter((file) => {
        const key = `${file.name}:${file.size}`;
        if (names.has(key)) return false;
        names.add(key);
        return true;
      })];
    });
    setError(null);
  }, []);

  // Ao abrir: retoma uma importação em andamento ou aguardando conferência.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setPhase("loading");
    setError(null);

    (async () => {
      try {
        const res = await fetch(`/api/clients/${clientSlug}/imports`);
        if (!res.ok) throw new Error(await readError(res, tr("Erro ao carregar importação", "Error loading the import")));
        const data = await res.json();
        if (cancelled) return;
        setQuota(data.quota);
        setConfigured(data.configured !== false);
        if (data.job) applyJob(data.job);
        else setPhase("upload");
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : tr("Erro ao carregar importação", "Error loading the import"));
        setPhase("upload");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, clientSlug, applyJob, tr]);

  useEffect(() => {
    if (open && initialFiles?.length) addFiles(initialFiles);
  }, [open, initialFiles, addFiles]);

  // Each step starts at its top: the reading screen scrolls along with the calendar.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 });
  }, [phase]);

  const jobId = job?.id;
  useEffect(() => {
    if (!open || phase !== "processing" || !jobId) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/imports/${jobId}`);
        if (!res.ok) throw new Error();
        const data = await res.json();
        setError(null);
        // Still reading: only the posts found so far change.
        if (data.job.status === "processing") setJob(data.job);
        else applyJob(data.job);
      } catch {
        setError(tr("Não conseguimos atualizar o andamento. Tentaremos novamente; não reenvie os arquivos.", "We couldn't update the progress. We'll keep trying; don't upload the files again."));
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, phase, jobId, applyJob, tr]);

  const docs = files.filter((file) => !isMediaFile(file));
  const mediaFiles = files.filter(isMediaFile);
  const docsSize = docs.reduce((sum, file) => sum + file.size, 0);
  const oversizedMedia = mediaFiles.filter((file) => file.size > MAX_MEDIA_BYTES);
  const repeatedNames = repeatedMediaNames(mediaFiles.map((file) => file.name.slice(0, 200)));
  const filesProblem =
    repeatedNames.length > 0
      ? tr(
          `Há artes com o mesmo nome: ${repeatedNames.join(", ")}. Renomeie antes de enviar.`,
          `Some creatives have the same name: ${repeatedNames.join(", ")}. Rename them before uploading.`
        )
      : docsSize > MAX_DOCS_BYTES
        ? tr(
            `Os documentos somam ${formatSize(docsSize)} e o máximo é 4 MB. Divida em duas importações ou envie um PDF menor.`,
            `The documents add up to ${formatSize(docsSize)} and the maximum is 4 MB. Split them into two imports or upload a smaller PDF.`
          )
        : docs.length > MAX_DOCS
          ? tr(`Máximo de ${MAX_DOCS} documentos por importação.`, `Maximum of ${MAX_DOCS} documents per import.`)
          : mediaFiles.length > MAX_IMPORT_MEDIA
            ? tr(`Máximo de ${MAX_IMPORT_MEDIA} artes por importação.`, `Maximum of ${MAX_IMPORT_MEDIA} creatives per import.`)
            : oversizedMedia.length > 0
              ? tr(
                  "Há artes acima de 4 MB (marcadas). Comprima ou tire daqui e anexe depois na publicação.",
                  "Some creatives are over 4 MB (marked). Compress them, or remove them here and attach them to the post later."
                )
              : null;
  const quotaReached = quota?.limit != null && quota.used >= quota.limit;

  const startImport = async () => {
    setBusy(true);
    setError(null);
    try {
      // Artes primeiro, uma por vez: o pedido da importação leva só as URLs.
      const uploaded: ImportMedia[] = [];
      for (const [index, file] of mediaFiles.entries()) {
        setProgress(tr(`Enviando artes (${index + 1} de ${mediaFiles.length})...`, `Uploading creatives (${index + 1} of ${mediaFiles.length})...`));
        const body = new FormData();
        body.append("file", file);
        const res = await fetch(`/api/clients/${clientSlug}/imports/media`, { method: "POST", body });
        if (!res.ok) throw new Error(await readError(res, tr(`Erro ao enviar "${file.name}"`, `Error uploading "${file.name}"`)));
        uploaded.push((await res.json()).media);
      }

      setProgress(tr("Enviando...", "Uploading..."));
      const formData = new FormData();
      docs.forEach((file) => formData.append("files", file));
      formData.append("media", JSON.stringify(uploaded));
      const res = await fetch(`/api/clients/${clientSlug}/imports`, { method: "POST", body: formData });
      if (!res.ok) throw new Error(await readError(res, tr("Erro ao iniciar importação", "Error starting the import")));
      const data = await res.json();
      setQuota((previous) => (previous ? { ...previous, used: previous.used + 1 } : previous));
      applyJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Erro ao iniciar importação", "Error starting the import"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const selected = drafts.filter((draft) => draft.include);
  const waiting = unconfirmedTimeCount(drafts);
  const overPostLimit = selected.length > MAX_POSTS;
  // Why "Create" is disabled, shown next to the button.
  const commitBlocker =
    selected.length === 0
      ? tr("Nenhuma publicação selecionada.", "No posts selected.")
      : overPostLimit
        ? tr(`O máximo é ${MAX_POSTS} publicações por importação. Tire algumas peças.`, `The maximum is ${MAX_POSTS} posts per import. Leave some pieces out.`)
        : waiting > 0
          ? waiting === 1
            ? tr("Falta escolher o horário de 1 publicação", "1 post still needs a time")
            : tr(`Falta escolher o horário de ${waiting} publicações`, `${waiting} posts still need a time`)
          : null;

  const resetAndClose = () => {
    reviewedJobId.current = null;
    setFiles([]);
    setJob(null);
    setDrafts([]);
    setError(null);
    onOpenChange(false);
  };

  const commit = async () => {
    if (!job || commitBlocker) return;
    const invalid = selected.find((draft) => !importDateTimeToIso(draft.scheduledLocal, timeZone));
    if (invalid) {
      setError(tr(
        `Confira a data e o horário de "${invalid.title || "publicação sem título"}". Horários na virada do horário de verão precisam de ajuste.`,
        `Check the date and time of "${invalid.title || "untitled post"}". Times on a daylight saving change need adjusting.`
      ));
      return;
    }

    setBusy(true);
    setError(null);
    const result = { created: selected.length, firstDate: selected.map((draft) => draft.scheduledLocal.slice(0, 10)).sort()[0] ?? null };
    try {
      const res = await fetch(`/api/imports/${job.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: selected.map((draft) => ({
            sourceIndex: Number(draft.key),
            scheduledAt: importDateTimeToIso(draft.scheduledLocal, timeZone)!,
            channel: draft.channel,
            format: draft.format,
            title: draft.title,
            copyText: draft.copyText,
            textOnly: draft.textOnly,
            handoffNote: buildImportNote({ ...draft.source, format: draft.format, notes: [
              draft.source.notes,
              !hasSourceTime(draft.source.time) && tr(
                `Horário ausente na fonte; escolhido na revisão: ${draft.scheduledLocal.slice(11)} (${timeZone}).`,
                `Time missing from the source; chosen during review: ${draft.scheduledLocal.slice(11)} (${timeZone}).`
              ),
              draft.textOnly && tr("Publicação só de texto, sem arte por decisão na revisão.", "Text-only post, no creative by decision during review."),
            ].filter(Boolean).join(" · ") }, locale),
            media: draft.media,
          })),
        }),
      });
      if (!res.ok) throw new Error(await readError(res, tr("Erro ao criar publicações", "Error creating posts")));
      resetAndClose();
      onImported(result);
    } catch (err) {
      // A lost response does not mean the transaction failed. Reconcile before retrying.
      const current = await fetch(`/api/imports/${job.id}`).then((res) => (res.ok ? res.json() : null)).catch(() => null);
      if (current?.job?.status === "committed") {
        resetAndClose();
        onImported({ created: current.job.postsCreated ?? result.created, firstDate: result.firstDate });
      } else setError(err instanceof Error ? err.message : tr("Erro ao criar publicações", "Error creating posts"));
    } finally {
      setBusy(false);
    }
  };

  const discard = async () => {
    if (!job) return;
    if (!window.confirm(tr("Descartar esta importação? A cota do mês continua usada.", "Discard this import? It still counts toward this month's quota."))) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/imports/${job.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await readError(res, tr("Não foi possível descartar a importação.", "Could not discard the import.")));
      reviewedJobId.current = null;
      setJob(null);
      setDrafts([]);
      setError(null);
      setPhase("upload");
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Erro ao descartar importação", "Error discarding the import"));
    } finally {
      setBusy(false);
    }
  };

  const step = phase === "review" ? 1 : phase === "processing" ? 1 : 0;
  const fileRow = (file: File) => {
    const media = isMediaFile(file);
    const video = media && (file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name));
    const tooBig = media && file.size > MAX_MEDIA_BYTES;
    const extension = (file.name.split(".").pop() ?? "").slice(0, 4).toUpperCase();
    return (
      <li
        key={`${file.name}:${file.size}`}
        className={cn("flex items-center gap-3.5 rounded-2xl border bg-card px-4 py-3", tooBig && "border-destructive/60")}
      >
        <span
          aria-hidden="true"
          className={cn(
            "flex h-14 w-12 shrink-0 items-end justify-center rounded-lg pb-2 text-xs font-bold tracking-wide",
            media ? "bg-brand-soft text-brand" : "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-200"
          )}
        >
          {media ? (video ? <Film className="mb-2 h-5 w-5" /> : <ImageIcon className="mb-2 h-5 w-5" />) : extension || <FileText className="mb-2 h-5 w-5" />}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <strong className="break-words font-semibold">{file.name}</strong>
          <span className={cn("text-sm", tooBig ? "font-medium text-destructive" : "text-muted-foreground")}>
            {formatSize(file.size)}
            {tooBig ? tr(" · acima de 4 MB", " · over 4 MB") : media ? "" : tr(" · pronto para ler", " · ready to read")}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-11 w-11 shrink-0 text-muted-foreground"
          onClick={() => setFiles((previous) => previous.filter((other) => other !== file))}
          aria-label={tr(`Remover ${file.name}`, `Remove ${file.name}`)}
        >
          <X className="h-4 w-4" />
        </Button>
      </li>
    );
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          // Focus the screen itself: a ring on "back" would be the first thing people see.
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
          className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-foreground outline-none data-[state=open]:animate-in data-[state=open]:fade-in-0 dark:bg-background"
          onDragOver={(event) => {
            if (phase !== "upload") return;
            event.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(event) => {
            if (phase !== "upload") return;
            event.preventDefault();
            setDragOver(false);
            addFiles(event.dataTransfer.files);
          }}
        >
          <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b bg-background px-4 py-2.5 sm:px-7">
            <DialogPrimitive.Close asChild>
              <button type="button" disabled={busy} className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg pr-2 font-semibold">
                <ChevronLeft aria-hidden="true" className="h-5 w-5 shrink-0" />
                <span className="truncate">{clientName}</span>
              </button>
            </DialogPrimitive.Close>
            <DialogPrimitive.Title className="sr-only">{tr("Importar planejamento com IA", "Import a plan with AI")}</DialogPrimitive.Title>
            <Stepper current={step} labels={[tr("Enviar", "Upload"), tr("Conferir", "Check"), tr("Pronto", "Done")]} />
            <DialogPrimitive.Close asChild>
              <Button type="button" variant="ghost" size="icon" disabled={busy} className="h-11 w-11 text-muted-foreground" aria-label={tr("Fechar e continuar depois", "Close and continue later")}>
                <X className="h-5 w-5" />
              </Button>
            </DialogPrimitive.Close>
          </header>

          <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {phase === "loading" && (
              <div className="flex justify-center py-24">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {phase === "upload" && (
              <div className="mx-auto flex w-full max-w-xl flex-col gap-5 px-6 py-12">
                <div className="space-y-1.5">
                  <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{tr("Envie o planejamento", "Upload the plan")}</h1>
                  <p className="text-muted-foreground">{tr("Um arquivo já basta. Nada é criado antes de você conferir.", "One file is enough. Nothing is created before you check it.")}</p>
                </div>

                {!configured && (
                  <p role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
                    {tr("A importação com IA ainda não está configurada neste ambiente.", "Import with AI is not configured in this environment yet.")}
                  </p>
                )}

                {docs.length > 0 && <ul className="flex flex-col gap-2">{docs.map(fileRow)}</ul>}

                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  className={cn(
                    "flex w-full flex-col items-center gap-2 rounded-2xl border-2 border-dashed text-center transition-colors",
                    docs.length ? "px-5 py-4" : "px-6 py-12",
                    dragOver ? "border-brand bg-brand-soft" : "border-slate-300 hover:bg-background dark:border-slate-700"
                  )}
                >
                  {docs.length === 0 && (
                    <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft text-brand">
                      <Upload className="h-6 w-6" />
                    </span>
                  )}
                  <span className={cn("font-semibold", docs.length === 0 && "font-display text-xl")}>
                    {docs.length ? tr("Adicionar outro documento", "Add another document") : tr("Solte o planejamento aqui ou clique para escolher", "Drop the plan here or click to choose")}
                  </span>
                  <span className="text-sm text-muted-foreground">{tr("PDF, DOCX, XLSX, CSV ou TXT · até 4 MB no total", "PDF, DOCX, XLSX, CSV or TXT · up to 4 MB in total")}</span>
                </button>
                <input
                  ref={docInputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                {mediaFiles.length > 0 && <ul className="flex flex-col gap-2">{mediaFiles.map(fileRow)}</ul>}

                <button
                  type="button"
                  onClick={() => mediaInputRef.current?.click()}
                  className="flex min-h-[76px] w-full items-center gap-3.5 rounded-2xl border-2 border-dashed border-slate-300 px-4 py-3 text-left transition-colors hover:bg-background dark:border-slate-700"
                >
                  <span aria-hidden="true" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
                    <ImageIcon className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span className="font-semibold">{mediaFiles.length ? tr("Adicionar mais artes", "Add more creatives") : tr("Já tem artes? Solte aqui", "Already have creatives? Drop them here")}</span>
                    <span className="text-sm text-muted-foreground">{tr("Opcional. A IA encaixa cada arte na data certa.", "Optional. The AI places each creative on the right date.")}</span>
                  </span>
                </button>
                <input
                  ref={mediaInputRef}
                  type="file"
                  multiple
                  accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime"
                  className="hidden"
                  onChange={(event) => {
                    if (event.target.files) addFiles(event.target.files);
                    event.target.value = "";
                  }}
                />

                {(filesProblem || error) && <p role="alert" className="text-sm font-medium text-destructive">{filesProblem ?? error}</p>}

                <Button
                  type="button"
                  onClick={startImport}
                  disabled={busy || !configured || quotaReached || files.length === 0 || Boolean(filesProblem)}
                  className="h-[52px] rounded-2xl bg-brand text-base font-semibold text-brand-foreground hover:bg-brand/90"
                >
                  {busy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {progress ?? tr("Enviando...", "Uploading...")}</>
                  ) : (
                    <>{tr("Montar calendário", "Build calendar")} <ArrowRight className="ml-2 h-4 w-4" /></>
                  )}
                </Button>

                {quota && quota.limit !== null && (
                  <p className={cn("text-center text-[13px]", quotaReached ? "font-medium text-destructive" : "text-muted-foreground")}>
                    {quotaReached
                      ? tr(`As ${quota.limit} importações deste mês já foram usadas.`, `All ${quota.limit} imports for this month have been used.`)
                      : tr(`${quota.used} de ${quota.limit} importações deste mês`, `${quota.used} of ${quota.limit} imports this month`)}
                  </p>
                )}
              </div>
            )}

            {phase === "processing" && job && (
              <>
                <ImportProgress posts={job.progress} fileNames={[...job.files, ...job.media].map((file) => file.name)} />
                {error && <p role="alert" className="px-6 pb-8 text-center text-sm font-medium text-destructive">{error}</p>}
              </>
            )}

            {phase === "failed" && (
              <div className="mx-auto flex w-full max-w-md flex-col items-center gap-4 px-6 py-24 text-center">
                <AlertTriangle className="h-9 w-9 text-destructive" />
                <h1 className="font-display text-2xl font-semibold">{tr("Não foi possível montar o calendário", "Could not build the calendar")}</h1>
                {error && <p role="alert" className="text-muted-foreground">{error}</p>}
                <Button
                  type="button"
                  className="h-11"
                  onClick={() => {
                    setError(null);
                    setJob(null);
                    setPhase("upload");
                  }}
                >
                  {tr("Tentar de novo", "Try again")}
                </Button>
              </div>
            )}

            {phase === "review" && job?.proposal && (
              <ImportReview job={job} drafts={drafts} onChange={setDrafts} timeZone={timeZone} onTimeZone={setTimeZone} />
            )}
          </div>

          {phase === "review" && job?.proposal && (
            <footer className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t bg-background px-4 py-3 sm:px-7">
              <Button type="button" variant="ghost" onClick={discard} disabled={busy} className="h-12 text-muted-foreground">
                {tr("Descartar", "Discard")}
              </Button>
              <div className="flex flex-wrap items-center justify-end gap-4">
                {error ? (
                  <p role="alert" className="max-w-md text-sm font-medium text-destructive">{error}</p>
                ) : commitBlocker ? (
                  <p aria-live="polite" className="text-sm font-semibold text-amber-800 dark:text-amber-300">{commitBlocker}</p>
                ) : (
                  <p className="text-sm text-muted-foreground">{tr("Nada vai para as redes. Dá para editar tudo depois.", "Nothing is posted to social networks. You can edit everything later.")}</p>
                )}
                <Button
                  type="button"
                  onClick={commit}
                  disabled={busy || Boolean(commitBlocker)}
                  className="h-12 rounded-2xl bg-brand px-6 text-[15px] font-semibold text-brand-foreground hover:bg-brand/90 disabled:bg-muted disabled:text-muted-foreground disabled:opacity-100"
                >
                  {busy ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr("Criando...", "Creating...")}</>
                  ) : selected.length === 1 ? (
                    tr("Criar 1 publicação", "Create 1 post")
                  ) : (
                    tr(`Criar ${selected.length} publicações`, `Create ${selected.length} posts`)
                  )}
                </Button>
              </div>
            </footer>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
