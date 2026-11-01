"use client";

import { useState } from "react";
import {
  ChevronLeft, ChevronRight, Film, Loader2, MessageCircle, Plus, Trash2, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { MediaSourceInput } from "./media-source-input";
import { SlideMediaThumb } from "./slide-media-preview";
import type { ResolvedSlide } from "@/lib/attachment-slides";
import type { AttachmentVersion } from "@/lib/types";

const TILE_ASPECT: Record<"square" | "story" | "auto", string> = {
  square: "aspect-square",
  story: "aspect-[9/16]",
  auto: "aspect-[4/5]",
};

interface AttachmentSlideGridProps {
  versionId: string;
  attachmentType: string;
  slides: ResolvedSlide[];
  aspectRatio: "square" | "story" | "auto";
  onOpenSlide: (index: number) => void;
  /** Quando presente, o grid permite adicionar, reordenar e remover slides. */
  onVersionUpdated?: (version: AttachmentVersion) => void;
}

export function AttachmentSlideGrid({
  versionId,
  attachmentType,
  slides,
  aspectRatio,
  onOpenSlide,
  onVersionUpdated,
}: AttachmentSlideGridProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  // Slides legados (sem id) não passam pela API de slides.
  const canManage = !!onVersionUpdated && slides.every((slide) => slide.id);
  const minSlides = attachmentType === "carousel" ? 2 : 1;
  const tileAspect = TILE_ASPECT[aspectRatio];

  const patchVersion = async (
    method: "PATCH" | "POST" | "DELETE",
    body?: Record<string, unknown>
  ) => {
    const response = await fetch(`/api/attachment-versions/${versionId}/slides`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(typeof data.error === "string" ? data.error : tr("Erro ao atualizar slides", "Could not update slides"));
    }
    onVersionUpdated?.(data.version);
  };

  const moveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const ids = slides.map((slide) => slide.id as string);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(ids[index]);
    try {
      await patchVersion("PATCH", { slideIds: ids });
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao reordenar", "Could not reorder"));
    } finally {
      setBusy(null);
    }
  };

  const deleteSlide = async (slideId: string) => {
    if (!confirm(tr("Remover este slide?", "Remove this slide?"))) return;
    setBusy(slideId);
    try {
      await patchVersion("DELETE", { slideId });
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao remover slide", "Could not remove slide"));
    } finally {
      setBusy(null);
    }
  };

  const addSlide = async () => {
    if (!newUrl.trim()) return;
    setBusy("add");
    try {
      await patchVersion("POST", { url: newUrl, mediaType: newMediaType });
      setNewUrl("");
      setShowAdd(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao adicionar slide", "Could not add slide"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto overscroll-contain px-4 pb-4 pt-1" data-section="slide-grid">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] sm:grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {slides.map((slide, index) => {
          const openPins = slide.pins.filter((pin) => !pin.resolved).length;
          const isVideo = slide.mediaType === "video";

          return (
            <div
              key={slide.id ?? `legacy-${slide.order}`}
              className={`group relative ${tileAspect} rounded-md border bg-background overflow-hidden shadow-sm`}
            >
              <button
                type="button"
                onClick={() => onOpenSlide(index)}
                className="absolute inset-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-inset rounded-md"
                aria-label={tr(`Abrir slide ${index + 1}`, `Open slide ${index + 1}`)}
              >
                <SlideMediaThumb url={slide.url} mediaType={slide.mediaType} />
              </button>

              <span className="pointer-events-none absolute top-1.5 left-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-background/90 border px-1.5 text-[10px] font-semibold shadow-sm">
                {index + 1}
              </span>

              <div className="pointer-events-none absolute top-1.5 right-1.5 flex items-center gap-1">
                {isVideo && (
                  <span className="flex items-center rounded-full bg-background/90 border p-1 shadow-sm">
                    <Film className="h-3 w-3" />
                  </span>
                )}
                {openPins > 0 && (
                  <span className="flex items-center gap-0.5 rounded-full bg-orange-500 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow">
                    <MessageCircle className="h-3 w-3" />
                    {openPins}
                  </span>
                )}
              </div>

              {canManage && (
                <div className="absolute inset-x-1.5 bottom-1.5 flex items-center justify-between gap-1 rounded-md border bg-background/95 px-1 py-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
                  {busy === slide.id ? (
                    <Loader2 className="mx-auto my-1 h-3.5 w-3.5 animate-spin text-muted-foreground" />
                  ) : (
                    <>
                      <div className="flex items-center">
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={index === 0 || busy !== null}
                          onClick={() => moveSlide(index, -1)}
                          aria-label={tr("Mover para a esquerda", "Move left")}
                        >
                          <ChevronLeft className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          disabled={index === slides.length - 1 || busy !== null}
                          onClick={() => moveSlide(index, 1)}
                          aria-label={tr("Mover para a direita", "Move right")}
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-destructive"
                        disabled={slides.length <= minSlides || busy !== null}
                        onClick={() => deleteSlide(slide.id as string)}
                        aria-label={tr("Remover slide", "Remove slide")}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}

        {canManage && !showAdd && (
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className={`${tileAspect} flex flex-col items-center justify-center gap-1.5 rounded-md border-2 border-dashed border-muted-foreground/30 text-muted-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:text-foreground`}
          >
            <Plus className="h-6 w-6" />
            <span className="text-xs font-medium">{tr("Adicionar imagem", "Add image")}</span>
          </button>
        )}

        {canManage && showAdd && (
          <div className="col-span-full rounded-md border bg-background p-3 space-y-2 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">{tr("Novo slide", "New slide")}</p>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                onClick={() => {
                  setShowAdd(false);
                  setNewUrl("");
                }}
                aria-label={tr("Cancelar", "Cancel")}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            <MediaSourceInput
              value={newUrl}
              onChange={(url, mediaType) => {
                setNewUrl(url);
                if (mediaType) setNewMediaType(mediaType);
              }}
              compact
              allowVideo
            />
            <Button
              type="button"
              size="sm"
              className="w-full"
              disabled={!newUrl.trim() || busy === "add"}
              onClick={addSlide}
            >
              {busy === "add" ? (
                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-1" />
              )}
              {tr("Adicionar slide", "Add slide")}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
