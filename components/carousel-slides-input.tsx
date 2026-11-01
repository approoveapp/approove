"use client";

import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MediaSourceInput } from "./media-source-input";
import { BatchMediaUpload } from "./batch-media-upload";
import { SlideMediaThumb } from "./slide-media-preview";
import type { MediaType } from "@/lib/media-utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

export interface SlideDraft {
  url: string;
  mediaType: MediaType;
}

interface CarouselSlidesInputProps {
  slides: SlideDraft[];
  onChange: (slides: SlideDraft[]) => void;
  aspectRatio?: "square" | "story" | "auto";
  dense?: boolean;
}

export function CarouselSlidesInput({
  slides,
  onChange,
  aspectRatio = "square",
  dense = false,
}: CarouselSlidesInputProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const updateSlide = (index: number, patch: Partial<SlideDraft>) => {
    const next = [...slides];
    next[index] = { ...next[index], ...patch };
    if (patch.url !== undefined) {
      next[index].mediaType = patch.mediaType ?? next[index].mediaType;
    }
    onChange(next);
  };

  const moveSlide = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= slides.length) return;
    const next = [...slides];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const addSlide = () => onChange([...slides, { url: "", mediaType: "image" }]);

  const removeSlide = (index: number) => {
    if (slides.length <= 2) return;
    onChange(slides.filter((_, i) => i !== index));
  };

  const handleBatchUpload = (uploaded: { url: string; mediaType: MediaType }[]) => {
    const filled = slides.filter((slide) => slide.url.trim().length > 0);
    const emptySlots = slides.filter((slide) => slide.url.trim().length === 0);
    const merged = [
      ...filled,
      ...uploaded,
      ...emptySlots.slice(uploaded.length),
    ];
    if (merged.length < 2) {
      while (merged.length < 2) merged.push({ url: "", mediaType: "image" });
    }
    onChange(merged);
  };

  return (
    <div className="space-y-3">
      <BatchMediaUpload
        onUploaded={handleBatchUpload}
        label={tr("Arraste vários arquivos de uma vez", "Drag in several files at once")}
        className={dense ? "py-2" : undefined}
      />

      {slides.map((slide, index) => (
        <div key={index} className="rounded-lg border p-3 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-10 h-10 shrink-0">
                <SlideMediaThumb url={slide.url} mediaType={slide.mediaType} />
              </div>
              <p className="text-xs font-medium text-muted-foreground">
                Slide {index + 1}
                {slide.mediaType === "video" ? tr(" · vídeo", " · video") : ""}
              </p>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index === 0}
                onClick={() => moveSlide(index, -1)}
                aria-label={tr("Mover para cima", "Move up")}
              >
                <ChevronUp className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={index === slides.length - 1}
                onClick={() => moveSlide(index, 1)}
                aria-label={tr("Mover para baixo", "Move down")}
              >
                <ChevronDown className="h-3.5 w-3.5" />
              </Button>
              {slides.length > 2 && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7 text-destructive"
                  onClick={() => removeSlide(index)}
                  aria-label={tr(`Remover slide ${index + 1}`, `Remove slide ${index + 1}`)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
          <MediaSourceInput
            value={slide.url}
            onChange={(url, mediaType) =>
              updateSlide(index, { url, mediaType: mediaType ?? slide.mediaType })
            }
            aspectRatio={aspectRatio}
            compact
            dense={dense}
            allowVideo
          />
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" className="w-full" onClick={addSlide}>
        <Plus className="h-4 w-4 mr-1" />
        {tr("Adicionar slide", "Add slide")}
      </Button>
    </div>
  );
}
