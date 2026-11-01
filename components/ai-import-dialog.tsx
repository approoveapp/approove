"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  FileText,
  Film,
  ImageIcon,
  Loader2,
  Sparkles,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import {
  buildImportNote,
  IMPORT_CHANNELS,
  importFormatLabel,
  IMPORT_FORMATS,
  MAX_IMPORT_MEDIA,
  proposalLocalDateTime,
  unusedMediaNames,
  type ImportMedia,
  type ImportProposalPost,
  type ImportFormat,
} from "@/lib/import/proposal";
import { DEFAULT_IMPORT_TIMEZONE, IMPORT_TIMEZONES, importDateTimeToIso, repeatedMediaNames, duplicatePostKeys, reviewSummary, hasSourceTime, unconfirmedTimeCount } from "@/lib/import/review";
import type { SerializedImportJob } from "@/lib/import/jobs";

const ACCEPT =
  ".pdf,.docx,.xlsx,.csv,.tsv,.txt,.md,image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime";
/** Documentos vão juntos num pedido; cada mídia vai num pedido próprio (teto de 4,5 MB na Vercel). */
const MAX_DOCS_BYTES = 4 * 1024 * 1024;
const MAX_DOCS = 10;
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;
const POLL_MS = 3000;
/** Avisos além disso ficam recolhidos para os posts aparecerem sem rolar. */
const WARNINGS_PREVIEW = 3;

type Phase = "loading" | "upload" | "processing" | "review" | "failed";

interface Draft {
  key: string;
  include: boolean;
  scheduledLocal: string;
  timeConfirmed: boolean;
  channel: string;
  title: string;
  copyText: string;
  media: string[];
  format: ImportFormat;
  textOnly: boolean;
  source: ImportProposalPost;
}

interface Quota {
  used: number;
  limit: number | null;
}

interface AiImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientSlug: string;
  clientName: string;
  onImported: () => void;
}

function toDrafts(posts: ImportProposalPost[], media: ImportMedia[]): Draft[] {
  const known = new Set(media.map((item) => item.name));
  return posts
    .map((post, index) => ({
      key: `${index}`,
      include: true,
      scheduledLocal: proposalLocalDateTime(post),
      timeConfirmed: hasSourceTime(post.time),
      channel: post.channel,
      title: post.title,
      copyText: post.copyText,
      format: post.format,
      textOnly: false,
      // Nome que não está entre as mídias enviadas é descartado aqui; o servidor recusaria.
      media: post.media.filter((name) => known.has(name)),
      source: post,
    }))
    .sort((a, b) => a.scheduledLocal.localeCompare(b.scheduledLocal));
}

function isMediaFile(file: File) {
  return /^(image|video)\//.test(file.type) || /\.(jpe?g|png|gif|webp|mp4|mov)$/i.test(file.name);
}

function formatSize(bytes: number) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

async function readError(res: Response, fallback: string) {
  const data = await res.json().catch(() => ({}));
  return typeof data.error === "string" ? data.error : fallback;
}

export function AiImportDialog({
  open,
  onOpenChange,
  clientSlug,
  clientName,
  onImported,
}: AiImportDialogProps) {
  const locale = useLocale();
  const tr = useCallback((pt: string, en: string) => localizedText(locale, pt, en), [locale]);
  const inputRef = useRef<HTMLInputElement>(null);
  const reviewedJobId = useRef<string | null>(null);
  const [timeZone, setTimeZone] = useState(DEFAULT_IMPORT_TIMEZONE);
  const [phase, setPhase] = useState<Phase>("loading");
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [job, setJob] = useState<SerializedImportJob | null>(null);
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [configured, setConfigured] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reviewAcknowledged, setReviewAcknowledged] = useState(false);
  useEffect(() => { setReviewAcknowledged(false); }, [drafts, timeZone, job?.id]);
  const [showAllWarnings, setShowAllWarnings] = useState(false);

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
      setShowAllWarnings(false);
      setPhase("review");
    } else {
      setError(next.error ?? tr("A importação falhou. Tente de novo.", "The import failed. Try again."));
      setPhase("failed");
    }
  }, [tr]);

  // Ao abrir: retoma uma importação em andamento ou aguardando revisão.
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
    if (!open || phase !== "processing" || !job) return;
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`/api/imports/${job.id}`);
        if (!res.ok) throw new Error(await readError(res, tr("Não foi possível atualizar o andamento.", "Could not update the progress.")));
        const data = await res.json();
        setError(null);
        if (data.job.status !== "processing") applyJob(data.job);
      } catch {
        setError(tr("Não conseguimos atualizar o andamento. Tentaremos novamente; não reenvie os arquivos.", "We couldn't update the progress. We'll keep trying; don't upload the files again."));
      }
    }, POLL_MS);
    return () => clearInterval(timer);
  }, [open, phase, job, applyJob, tr]);

  const docs = files.filter((file) => !isMediaFile(file));
  const mediaFiles = files.filter(isMediaFile);
  const docsSize = docs.reduce((sum, file) => sum + file.size, 0);
  const oversizedMedia = mediaFiles.filter((file) => file.size > MAX_MEDIA_BYTES);
  const repeatedNames = repeatedMediaNames(mediaFiles.map(file => file.name.slice(0, 200)));
  const filesProblem =
    repeatedNames.length > 0
      ? tr(
          `Há artes com o mesmo nome: ${repeatedNames.join(", ")}. Renomeie antes de enviar para evitar associações incorretas.`,
          `Some creatives have the same name: ${repeatedNames.join(", ")}. Rename them before uploading to avoid wrong matches.`
        )
      : docsSize > MAX_DOCS_BYTES
      ? tr(
          `Os documentos somam ${formatSize(docsSize)} e o máximo é 4 MB no total. Divida em duas importações ou envie um PDF menor.`,
          `The documents add up to ${formatSize(docsSize)} and the maximum is 4 MB in total. Split them into two imports or upload a smaller PDF.`
        )
      : docs.length > MAX_DOCS
        ? tr(`Máximo de ${MAX_DOCS} documentos por importação.`, `Maximum of ${MAX_DOCS} documents per import.`)
        : mediaFiles.length > MAX_IMPORT_MEDIA
          ? tr(`Máximo de ${MAX_IMPORT_MEDIA} imagens e vídeos por importação.`, `Maximum of ${MAX_IMPORT_MEDIA} images and videos per import.`)
          : oversizedMedia.length > 0
            ? oversizedMedia.length === 1
              ? tr(
                  "Um arquivo passa de 4 MB (marcado acima). Comprima e envie de novo, ou tire daqui e anexe depois no calendário de produção.",
                  "One file is over 4 MB (marked above). Compress it and upload it again, or remove it here and attach it later in the production calendar."
                )
              : tr(
                  `${oversizedMedia.length} arquivos passam de 4 MB (marcados acima). Comprima e envie de novo, ou tire daqui e anexe depois no calendário de produção.`,
                  `${oversizedMedia.length} files are over 4 MB (marked above). Compress them and upload them again, or remove them here and attach them later in the production calendar.`
                )
            : null;
  const quotaReached = quota?.limit != null && quota.used >= quota.limit;

  const addFiles = (list: FileList | File[]) => {
    const incoming = Array.from(list).filter((file) => file.size > 0);
    setFiles((prev) => {
      const names = new Set(prev.map((file) => `${file.name}:${file.size}`));
      return [...prev, ...incoming.filter((file) => {
        const key = `${file.name}:${file.size}`;
        if (names.has(key)) return false;
        names.add(key);
        return true;
      })];
    });
    setError(null);
  };

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

      setProgress(tr("Enviando documentos...", "Uploading documents..."));
      const formData = new FormData();
      docs.forEach((file) => formData.append("files", file));
      formData.append("media", JSON.stringify(uploaded));
      const res = await fetch(`/api/clients/${clientSlug}/imports`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) throw new Error(await readError(res, tr("Erro ao iniciar importação", "Error starting the import")));
      const data = await res.json();
      setQuota((prev) => (prev ? { ...prev, used: prev.used + 1 } : prev));
      applyJob(data.job);
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Erro ao iniciar importação", "Error starting the import"));
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const updateDraft = (key: string, patch: Partial<Draft>) =>
    setDrafts((prev) => prev.map((draft) => (draft.key === key ? { ...draft, ...patch } : draft)));

  const warnings = job?.proposal?.warnings ?? [];
  // Recolher só quando sobra mais de um aviso escondido.
  const warningsCollapsible = warnings.length > WARNINGS_PREVIEW + 1;
  const visibleWarnings =
    warningsCollapsible && !showAllWarnings ? warnings.slice(0, WARNINGS_PREVIEW) : warnings;

  const selected = drafts.filter((draft) => draft.include);
  const duplicateKeys = duplicatePostKeys(selected);
  const missingTimeDecisions = unconfirmedTimeCount(drafts);
  const overPostLimit = selected.length > 200;
  const allSelected = drafts.length > 0 && selected.length === drafts.length;
  const mediaByName = new Map((job?.media ?? []).map((item) => [item.name, item]));
  const unusedMedia = unusedMediaNames(job?.media ?? [], selected);

  const commit = async () => {
    if (!job) return;
    if (!reviewAcknowledged) { setError(tr("Confira a fonte, os avisos e as mídias antes de confirmar.", "Check the source, the warnings and the media before confirming.")); return; }
    if (missingTimeDecisions) { setError(tr("Confirme ou escolha os horários ausentes na fonte antes de criar publicações.", "Confirm or choose the times missing from the source before creating posts.")); return; }
    const invalid = selected.find((draft) => !importDateTimeToIso(draft.scheduledLocal, timeZone));
    if (invalid) {
      setError(tr(
        `Confira data, horário e fuso em "${invalid.title || "publicação sem título"}". Horários ambíguos na mudança de horário de verão precisam de ajuste.`,
        `Check the date, time and time zone of "${invalid.title || "untitled post"}". Times made ambiguous by a daylight saving change need adjusting.`
      ));
      return;
    }
    if (overPostLimit) { setError(tr("Selecione no máximo 200 publicações por importação.", "Select at most 200 posts per import.")); return; }

    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/imports/${job.id}/commit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reviewAcknowledged,
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
      onImported();
    } catch (err) {
      // A lost response does not mean the transaction failed. Reconcile before retrying.
      const current = await fetch(`/api/imports/${job.id}`).then(res => res.ok ? res.json() : null).catch(() => null);
      if (current?.job?.status === "committed") {
        window.alert(tr("Esta importação já foi confirmada. Confira o calendário: as alterações desta tentativa podem não ter sido aplicadas.", "This import was already confirmed. Check the calendar: the changes from this attempt may not have been applied."));
        resetAndClose(); onImported();
      }
      else setError(err instanceof Error ? err.message : tr("Erro ao criar publicações", "Error creating posts"));
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

  const resetAndClose = () => {
    reviewedJobId.current = null;
    setFiles([]);
    setJob(null);
    setDrafts([]);
    setError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(value) => { if (!busy) onOpenChange(value); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {tr("Importar com IA", "Import with AI")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground pt-1">
            {phase === "review"
              ? tr("Confira as publicações encontradas. Nada é criado até você confirmar.", "Check the posts found. Nothing is created until you confirm.")
              : tr(
                  `Envie o planejamento, a planilha de pauta e as artes de ${clientName}. A IA migra o calendário com datas, legendas e artes, e você revisa antes de criar.`,
                  `Upload ${clientName}'s plan, content spreadsheet and creatives. The AI migrates the calendar with dates, captions and creatives. You review and edit before anything is created.`
                )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-6 pb-4 space-y-4">
          {phase === "loading" && (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {phase === "upload" && (
            <>
              {!configured && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  {tr("A importação com IA ainda não está configurada neste ambiente.", "Import with AI is not configured in this environment yet.")}
                </p>
              )}

              <div
                role="button"
                tabIndex={0}
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
                className={cn(
                  "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center cursor-pointer transition-colors",
                  dragOver ? "border-primary bg-primary/5" : "hover:bg-muted/40"
                )}
              >
                <Upload className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm font-medium">{tr("Arraste os arquivos ou clique para escolher", "Drag files here or click to choose")}</p>
                <p className="text-xs text-muted-foreground">
                  {tr("Documentos (PDF, DOCX, XLSX, CSV, TXT): até 10 e 4 MB no total", "Documents (PDF, DOCX, XLSX, CSV, TXT): up to 10, 4 MB in total")}
                  <br />
                  {tr("Artes (imagens e vídeos): até 30, com até 4 MB cada", "Creatives (images and videos): up to 30, up to 4 MB each")}
                </p>
                <input
                  ref={inputRef}
                  type="file"
                  multiple
                  accept={ACCEPT}
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) addFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  {files.map((file, index) => {
                    const tooBig = isMediaFile(file) && file.size > MAX_MEDIA_BYTES;
                    return (
                      <div
                        key={`${file.name}-${file.size}`}
                        className={cn(
                          "flex items-center justify-between gap-2 rounded-lg border px-3 py-2",
                          tooBig && "border-destructive/60 bg-destructive/5"
                        )}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {!isMediaFile(file) ? (
                            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : file.type.startsWith("video/") || /\.(mp4|mov)$/i.test(file.name) ? (
                            <Film className="h-4 w-4 shrink-0 text-muted-foreground" />
                          ) : (
                            <ImageIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm truncate">{file.name}</span>
                          <span
                            className={cn("text-xs shrink-0", tooBig ? "text-destructive font-medium" : "text-muted-foreground")}
                          >
                            {formatSize(file.size)}
                            {tooBig && tr(" · acima de 4 MB", " · over 4 MB")}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-destructive"
                          onClick={() => setFiles((prev) => prev.filter((_, i) => i !== index))}
                          aria-label={tr(`Remover ${file.name}`, `Remove ${file.name}`)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })}
                  {filesProblem && <p className="text-xs text-destructive">{filesProblem}</p>}
                </div>
              )}

              <p className="text-xs text-muted-foreground">
                {tr(
                  "A IA foi orientada a transcrever o que está nos arquivos. Confira legendas, datas e artes na revisão. Artes dentro de PDFs não são extraídas: envie também os arquivos originais.",
                  "The AI is instructed to transcribe what is in the files. Check captions, dates and creatives during review. Creatives inside PDFs are not extracted: upload the original files too."
                )}
              </p>

              {quota && quota.limit !== null && (
                <p className={cn("text-xs", quotaReached ? "text-destructive" : "text-muted-foreground")}>
                  {tr(
                    `${quota.used} de ${quota.limit} importações com IA usadas este mês.`,
                    `${quota.used} of ${quota.limit} AI imports used this month.`
                  )}
                </p>
              )}
            </>
          )}

          {phase === "processing" && (
            <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="font-medium">{tr("Lendo os arquivos e montando o calendário...", "Reading the files and building the calendar...")}</p>
              <p className="text-sm text-muted-foreground max-w-sm">
                {tr(
                  "Costuma levar de 1 a 3 minutos. Você pode fechar esta janela: a revisão fica esperando aqui quando voltar.",
                  "This usually takes 1 to 3 minutes. You can close this window: the review will be waiting here when you come back."
                )}
              </p>
              {job && job.files.length + job.media.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {[...job.files, ...job.media].map((file) => file.name).join(", ")}
                </p>
              )}
            </div>
          )}

          {phase === "failed" && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <p className="font-medium">{tr("Não foi possível montar o calendário", "Could not build the calendar")}</p>
            </div>
          )}

          {phase === "review" && job?.proposal && (
            <>
              <p className="text-sm" aria-live="polite">{reviewSummary(drafts, locale)}</p>
              <label className="flex gap-2 rounded-lg border border-amber-300 p-3 text-sm">
                <input type="checkbox" checked={reviewAcknowledged} onChange={e => setReviewAcknowledged(e.target.checked)} />
                {tr(
                  "Conferi a proposta com a fonte, todos os avisos e as mídias que ficaram sem associação. Confirmo as exclusões e alterações da revisão.",
                  "I checked the proposal against the source, every warning and the media left unlinked. I confirm the exclusions and changes made during review."
                )}
              </label>
              {missingTimeDecisions > 0 && <p role="alert" className="text-sm text-amber-800">{tr(
                `${missingTimeDecisions} publicações selecionadas não têm horário válido na fonte. O campo mostra uma sugestão; escolha ou confirme cada horário antes de criar.`,
                `${missingTimeDecisions === 1 ? "1 selected post has" : `${missingTimeDecisions} selected posts have`} no valid time in the source. The field shows a suggestion; choose or confirm each time before creating.`
              )}</p>}
              <p className="text-xs text-muted-foreground">{tr(
                "Compare as ocorrências e suas fontes com os arquivos originais. A IA pode omitir itens; a conferência automática cobre apenas linhas tabulares com cabeçalhos e canais reconhecidos.",
                "Compare the occurrences and their sources with the original files. The AI may leave items out; the automatic check only covers table rows with recognized headers and channels."
              )}</p>
              <label className="flex flex-wrap items-center gap-2 text-sm">
                {tr("Fuso dos horários da pauta", "Time zone of the scheduled times")}
                <select aria-label={tr("Fuso dos horários", "Time zone")} value={timeZone} onChange={e => setTimeZone(e.target.value)} className="h-9 rounded-md border bg-background px-2">
                  {IMPORT_TIMEZONES.map(zone => <option key={zone} value={zone}>{zone}</option>)}
                </select>
              </label>
              <p className="text-xs text-muted-foreground">{tr(
                "As edições são mantidas ao fechar e reabrir nesta aba. Recarregar a página restaura a proposta original. Criar publicações não publica nas redes nem aprova pelo cliente.",
                "Edits are kept if you close and reopen this dialog in this tab. Reloading the page restores the original proposal. Creating posts does not publish to social networks or approve on the client's behalf."
              )}</p>
              {overPostLimit && <p role="alert" className="text-sm text-destructive">{tr(
                "A proposta tem mais de 200 selecionadas. Selecione até 200; confira as restantes antes de encerrar.",
                "More than 200 posts are selected. Select up to 200; check the rest before finishing."
              )}</p>}
              {duplicateKeys.size > 0 && <p role="alert" className="text-sm text-amber-800">{tr(
                `Há ${duplicateKeys.size} publicações aparentemente repetidas. A revisão mantém esses itens selecionados até sua decisão. Desmarque apenas as ocorrências que deseja excluir.`,
                `${duplicateKeys.size} posts appear to be repeated. Review keeps them selected until you decide. Uncheck only the occurrences you want to exclude.`
              )}</p>}

              {warnings.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300">
                  <p className="font-medium flex items-center gap-1.5 mb-1">
                    <AlertTriangle className="h-4 w-4" /> {tr("Para conferir", "To check")} ({warnings.length})
                  </p>
                  <ul className="list-disc pl-5 space-y-0.5">
                    {visibleWarnings.map((warning, index) => (
                      <li key={index}>{warning}</li>
                    ))}
                  </ul>
                  {warningsCollapsible && (
                    <button
                      type="button"
                      onClick={() => setShowAllWarnings((value) => !value)}
                      aria-expanded={showAllWarnings}
                      className="mt-2 flex items-center gap-1 text-xs font-medium underline-offset-2 hover:underline"
                    >
                      {showAllWarnings ? (
                        <><ChevronUp className="h-3.5 w-3.5" /> {tr("Mostrar menos", "Show less")}</>
                      ) : (
                        <><ChevronDown className="h-3.5 w-3.5" /> {tr(`Ver todos os ${warnings.length} avisos`, `See all ${warnings.length} warnings`)}</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {drafts.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  {tr("A IA não encontrou publicações nesses arquivos.", "The AI found no posts in these files.")}
                </p>
              ) : (
                <>
                  <label className="flex items-center gap-2 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) =>
                        setDrafts((prev) => prev.map((draft) => ({ ...draft, include: e.target.checked })))
                      }
                    />
                    {tr(
                      `${selected.length} de ${drafts.length} publicações selecionadas`,
                      `${selected.length} of ${drafts.length} posts selected`
                    )}
                  </label>

                  <div className="space-y-3">
                    {drafts.map((draft) => (
                      <div
                        key={draft.key}
                        className={cn(
                          "rounded-lg border p-3 space-y-2 transition-opacity",
                          !draft.include && "opacity-50"
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <input
                            type="checkbox"
                            checked={draft.include}
                            onChange={(e) => updateDraft(draft.key, { include: e.target.checked })}
                            aria-label={tr("Incluir publicação", "Include post")}
                          />
                          <Input
                            type="datetime-local"
                            aria-label={tr(`Data e horário de ${draft.title || "publicação"}`, `Date and time for ${draft.title || "post"}`)}
                            value={draft.scheduledLocal}
                            onChange={(e) => updateDraft(draft.key, { scheduledLocal: e.target.value, timeConfirmed: true })}
                            className="h-8 w-auto"
                          />
                          <select
                            aria-label={tr(`Canal de ${draft.title || "publicação"}`, `Channel for ${draft.title || "post"}`)}
                            value={draft.channel}
                            onChange={(e) => updateDraft(draft.key, { channel: e.target.value })}
                            className="h-8 px-2 rounded-md border bg-background text-sm"
                          >
                            {IMPORT_CHANNELS.map((channel) => (
                              <option key={channel} value={channel}>
                                {channel}
                              </option>
                            ))}
                          </select>
                          <select aria-label={tr(`Formato de ${draft.title || "publicação"}`, `Format for ${draft.title || "post"}`)} value={draft.format} onChange={e => updateDraft(draft.key, { format: e.target.value as ImportFormat })} className="h-8 px-2 rounded-md border bg-background text-sm">
                            {IMPORT_FORMATS.map(format => <option key={format} value={format}>{importFormatLabel(format, locale)}</option>)}
                          </select>
                          {!hasSourceTime(draft.source.time) && <label className="flex items-center gap-2 text-sm">
                            <input type="checkbox" checked={draft.timeConfirmed} onChange={e => updateDraft(draft.key, { timeConfirmed: e.target.checked })} />
                            {tr(
                              `Confirmo o horário escolhido para ${draft.title || "esta publicação"}; ausente na fonte`,
                              `I confirm the chosen time for ${draft.title || "this post"}; missing from the source`
                            )}
                          </label>}
                          {duplicateKeys.has(draft.key) && <Badge variant="secondary">{tr("Possível duplicata", "Possible duplicate")}</Badge>}
                          {draft.source.dateIsSuggested && (
                            <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                              {tr("Data sugerida", "Suggested date")}
                            </Badge>
                          )}
                          {!draft.copyText.trim() && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                              {tr("Sem legenda", "No caption")}
                            </Badge>
                          )}
                          {draft.media.length === 0 && !draft.textOnly && (
                            <Badge variant="secondary" className="bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-400">
                              {tr("Sem arte", "No creative")}
                            </Badge>
                          )}
                        </div>
                        <Input
                          value={draft.title}
                          onChange={(e) => updateDraft(draft.key, { title: e.target.value })}
                          placeholder={tr("Título", "Title")}
                          aria-label={tr("Título da publicação", "Post title")}
                          maxLength={300}
                          className="h-8"
                        />
                        <textarea
                          value={draft.copyText}
                          onChange={(e) => updateDraft(draft.key, { copyText: e.target.value })}
                          rows={3}
                          aria-label={tr(`Legenda de ${draft.title || "publicação"}`, `Caption for ${draft.title || "post"}`)}
                          maxLength={10000}
                          placeholder={tr("Sem legenda nos arquivos - o time escreve depois", "No caption in the files - the team writes it later")}
                          className="w-full px-3 py-2 rounded-md border bg-background text-sm resize-y"
                        />
                        {draft.media.length > 0 && (
                          <div className="flex flex-wrap gap-2">
                            {draft.media.map((name, index) => {
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
                                    {draft.media.length > 1 && (
                                      <span className="absolute top-1 left-1 rounded bg-black/60 px-1 text-[10px] text-white">
                                        {index + 1}
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateDraft(draft.key, { media: draft.media.filter((m) => m !== name) })
                                    }
                                    className="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 shadow-sm hover:bg-muted"
                                    aria-label={tr(`Tirar ${name} desta publicação`, `Remove ${name} from this post`)}
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                  <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{name}</p>
                                  {index > 0 && <button type="button" aria-label={tr(`Mover ${name} antes`, `Move ${name} earlier`)} className="text-xs underline" onClick={() => {
                                    const media = [...draft.media];
                                    [media[index - 1], media[index]] = [media[index], media[index - 1]];
                                    updateDraft(draft.key, { media });
                                  }}>{tr("Mover antes", "Move earlier")}</button>}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {job.media.some(item => !draft.media.includes(item.name)) && (
                          <select aria-label={tr(`Adicionar arte a ${draft.title || "publicação"}`, `Add creative to ${draft.title || "post"}`)} value="" onChange={e => { if (e.target.value) updateDraft(draft.key, { media: [...draft.media, e.target.value] }); }} className="h-8 max-w-full rounded-md border bg-background px-2 text-sm">
                            <option value="">{tr("Adicionar arte enviada...", "Add an uploaded creative...")}</option>
                            {job.media.filter(item => !draft.media.includes(item.name)).map(item => <option key={item.name} value={item.name}>{item.name}</option>)}
                          </select>
                        )}
                        {draft.media.length === 0 && <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <input type="checkbox" checked={draft.textOnly} onChange={e => updateDraft(draft.key, { textOnly: e.target.checked })} />
                          {tr("Publicação só de texto (dispensa arte)", "Text-only post (no creative needed)")}
                        </label>}
                        <p className="text-xs text-muted-foreground">
                          {tr("Fonte", "Source")}: {draft.source.source}
                          {draft.source.notes ? ` · ${draft.source.notes}` : ""}
                        </p>
                      </div>
                    ))}
                  </div>

                  {unusedMedia.length > 0 && (
                    <p className="rounded-lg border p-3 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">
                        {tr(
                          `${unusedMedia.length === 1 ? "1 arte não vai" : `${unusedMedia.length} artes não vão`} para nenhuma publicação:`,
                          `${unusedMedia.length === 1 ? "1 creative is not used" : `${unusedMedia.length} creatives are not used`} in any post:`
                        )}
                      </span>{" "}
                      {unusedMedia.join(", ")}
                    </p>
                  )}
                </>
              )}
            </>
          )}

          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="shrink-0 border-t px-6 py-4 flex gap-3 bg-background">
          {phase === "upload" && (
            <>
              <Button variant="outline" disabled={busy} onClick={() => onOpenChange(false)} className="flex-1">
                {tr("Cancelar", "Cancel")}
              </Button>
              <Button
                onClick={startImport}
                disabled={busy || !configured || quotaReached || files.length === 0 || Boolean(filesProblem)}
                className="flex-1"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {progress ?? tr("Enviando...", "Uploading...")}</>
                ) : (
                  <><Sparkles className="h-4 w-4 mr-2" /> {tr("Montar calendário", "Build calendar")}</>
                )}
              </Button>
            </>
          )}

          {phase === "processing" && (
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {tr("Fechar e continuar depois", "Close and continue later")}
            </Button>
          )}

          {phase === "failed" && (
            <>
              <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
                {tr("Fechar", "Close")}
              </Button>
              <Button
                onClick={() => {
                  setError(null);
                  setJob(null);
                  setPhase("upload");
                }}
                className="flex-1"
              >
                {tr("Tentar de novo", "Try again")}
              </Button>
            </>
          )}

          {phase === "review" && (
            <>
              <Button variant="outline" onClick={discard} disabled={busy} className="flex-1">
                {tr("Descartar", "Discard")}
              </Button>
              <Button onClick={commit} disabled={busy || selected.length === 0 || overPostLimit || missingTimeDecisions > 0 || !reviewAcknowledged} className="flex-1">
                {busy ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> {tr("Criando...", "Creating...")}</>
                ) : (
                  tr(
                    `Criar ${selected.length} ${selected.length === 1 ? "publicação" : "publicações"}`,
                    `Create ${selected.length} ${selected.length === 1 ? "post" : "posts"}`
                  )
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
