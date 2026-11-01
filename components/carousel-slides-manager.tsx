"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaSourceInput } from "./media-source-input";
import { SlideMediaThumb } from "./slide-media-preview";
import type { ResolvedSlide } from "@/lib/attachment-slides";
import type { AttachmentVersion } from "@/lib/types";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface CarouselSlidesManagerProps {
  versionId: string;
  attachmentType: string;
  slides: ResolvedSlide[];
  onVersionUpdated: (version: AttachmentVersion) => void;
}

export function CarouselSlidesManager({
  versionId,
  attachmentType,
  slides,
  onVersionUpdated,
}: CarouselSlidesManagerProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [busy, setBusy] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [newUrl, setNewUrl] = useState("");
  const [newMediaType, setNewMediaType] = useState<"image" | "video">("image");

  const persistedSlides = slides.filter((slide): slide is ResolvedSlide & { id: string } =>
    Boolean(slide.id)
  );

  if (persistedSlides.length === 0) return null;

  const minSlides = attachmentType === "carousel" ? 2 : 1;

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
      throw new Error(typeof data.error === "string" ? data.error : tr("Erro ao atualizar slides", "Failed to update slides"));
    }
    onVersionUpdated(data.version);
  };

  const moveSlide = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= persistedSlides.length) return;
    const ids = persistedSlides.map((slide) => slide.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    setBusy(ids[index]);
    try {
      await patchVersion("PATCH", { slideIds: ids });
    } catch (error) {
      alert(error instanceof Error ? error.message : tr("Erro ao reordenar", "Failed to reorder"));
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
      alert(error instanceof Error ? error.message : tr("Erro ao remover slide", "Failed to remove slide"));
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
      alert(error instanceof Error ? error.message : tr("Erro ao adicionar slide", "Failed to add slide"));
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{tr("Slides desta versão", "Slides in this version")}</p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 text-xs"
          onClick={() => setShowAdd((v) => !v)}
        >
          <Plus className="h-3 w-3 mr-1" />
          Slide
        </Button>
      </div>

      <div className="space-y-1.5">
        {persistedSlides.map((slide, index) => (
          <div
            key={slide.id}
            className="flex items-center gap-2 rounded-md border bg-background px-2 py-1.5"
          >
            <div className="w-9 h-9 shrink-0">
              <SlideMediaThumb url={slide.url} mediaType={slide.mediaType} />
            </div>
            <span className="text-xs flex-1 truncate">
              {index + 1}. {slide.mediaType === "video" ? tr("Vídeo", "Video") : tr("Imagem", "Image")}
            </span>
            <div className="flex items-center gap-0.5">
              {busy === slide.id ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
              ) : (
                <>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === 0}
                    onClick={() => moveSlide(index, -1)}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    disabled={index === persistedSlides.length - 1}
                    onClick={() => moveSlide(index, 1)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive"
                    disabled={persistedSlides.length <= minSlides}
                    onClick={() => deleteSlide(slide.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {showAdd && (
        <div className="space-y-2 pt-1 border-t">
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
  );
}
