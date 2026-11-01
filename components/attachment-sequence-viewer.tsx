"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Keyboard } from "swiper/modules";
import { ChevronLeft, ChevronRight, LayoutGrid, Square } from "lucide-react";
import { SlideMediaPreview } from "./slide-media-preview";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import { AttachmentSlideGrid } from "./attachment-slide-grid";
import { getAttachmentAspectRatio } from "./post-material-form";
import type { AttachmentVersion } from "@/lib/types";
import {
  isSequenceAttachment,
  resolveVersionSlides,
  type AttachmentVersionRecord,
} from "@/lib/attachment-slides";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

export type SequenceViewMode = "grid" | "single";

export function ViewModeToggle({
  value,
  onChange,
}: {
  value: SequenceViewMode;
  onChange: (mode: SequenceViewMode) => void;
}) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const options: { mode: SequenceViewMode; label: string; Icon: typeof LayoutGrid }[] = [
    { mode: "grid", label: "Grid", Icon: LayoutGrid },
    { mode: "single", label: tr("Individual", "Single"), Icon: Square },
  ];

  return (
    <div
      role="radiogroup"
      aria-label={tr("Modo de visualização", "View mode")}
      className="inline-flex shrink-0 items-center rounded-md border bg-background/90 p-0.5 shadow-sm"
      data-section="view-mode-toggle"
    >
      {options.map(({ mode, label, Icon }) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={value === mode}
          onClick={() => onChange(mode)}
          className={`flex h-7 items-center gap-1.5 rounded px-2.5 text-xs font-medium transition-colors ${
            value === mode
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Icon className="h-3.5 w-3.5" />
          {label}
        </button>
      ))}
    </div>
  );
}

interface AttachmentSequenceViewerProps {
  attachmentType: string;
  version: AttachmentVersionRecord;
  viewMode: SequenceViewMode;
  onViewModeChange: (mode: SequenceViewMode) => void;
  /** Habilita adicionar, reordenar e remover slides no grid. */
  onVersionUpdated?: (version: AttachmentVersion) => void;
  canAnnotate?: boolean;
  author?: "agency" | "client";
  onPinCreate?: (
    versionId: string,
    xPercent: number,
    yPercent: number,
    text: string,
    author: "agency" | "client",
    slideId?: string | null
  ) => void;
  onPinResolve?: (pinId: string, resolved: boolean) => void;
  onPinDelete?: (pinId: string) => void;
}

export function AttachmentSequenceViewer({
  attachmentType,
  version,
  viewMode,
  onViewModeChange,
  onVersionUpdated,
  canAnnotate = false,
  author = "agency",
  onPinCreate,
  onPinResolve,
  onPinDelete,
}: AttachmentSequenceViewerProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const slides = resolveVersionSlides(version);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const safeIndex = Math.min(activeSlideIndex, Math.max(slides.length - 1, 0));
  const currentSlide = slides[safeIndex];
  const showCarousel = isSequenceAttachment(attachmentType, slides.length);

  if (viewMode === "grid") {
    return (
      <AttachmentSlideGrid
        versionId={version.id}
        attachmentType={attachmentType}
        slides={slides}
        aspectRatio={getAttachmentAspectRatio(attachmentType)}
        onVersionUpdated={onVersionUpdated}
        onOpenSlide={(index) => {
          setActiveSlideIndex(index);
          onViewModeChange("single");
        }}
      />
    );
  }

  const renderSlide = (
    slide: (typeof slides)[number],
    onPinForSlide?: (
      xPercent: number,
      yPercent: number,
      text: string,
      pinAuthor: "agency" | "client"
    ) => void
  ) => (
    <SlideMediaPreview
      url={slide.url}
      mediaType={slide.mediaType}
      pins={slide.pins}
      canAnnotate={canAnnotate && slide.mediaType !== "video"}
      author={author}
      onPinCreate={onPinForSlide}
      onPinResolve={onPinResolve}
      onPinDelete={onPinDelete}
    />
  );

  if (!showCarousel) {
    return (
      <div className="absolute inset-0 px-4 pb-4 pt-1">
        {renderSlide(
          currentSlide,
          onPinCreate
            ? (x, y, text, pinAuthor) =>
                onPinCreate(version.id, x, y, text, pinAuthor, currentSlide.id)
            : undefined
        )}
      </div>
    );
  }

  return (
    <div className="absolute inset-0 px-4 pb-4 pt-1 flex flex-col min-h-0">
      <div className="relative flex-1 min-h-0">
        <Swiper
          modules={[Navigation, Pagination, Keyboard]}
          initialSlide={safeIndex}
          navigation={{
            prevEl: `.slide-prev-${version.id}`,
            nextEl: `.slide-next-${version.id}`,
          }}
          pagination={{
            clickable: true,
            dynamicBullets: true,
          }}
          keyboard={{ enabled: true }}
          onSlideChange={(swiper) => setActiveSlideIndex(swiper.activeIndex)}
          className="h-full w-full rounded-md"
        >
          {slides.map((slide) => (
            <SwiperSlide key={slide.id ?? `legacy-${slide.order}`} className="h-full">
              <div className="h-full w-full">
                {renderSlide(
                  slide,
                  onPinCreate && slide.mediaType !== "video"
                    ? (x, y, text, pinAuthor) =>
                        onPinCreate(version.id, x, y, text, pinAuthor, slide.id)
                    : undefined
                )}
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        {slides.length > 1 && (
          <>
            <button
              type="button"
              className={`slide-prev-${version.id} absolute left-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-background/90 shadow-sm hover:bg-accent`}
              aria-label={tr("Slide anterior", "Previous slide")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              className={`slide-next-${version.id} absolute right-2 top-1/2 -translate-y-1/2 z-10 flex h-8 w-8 items-center justify-center rounded-full border bg-background/90 shadow-sm hover:bg-accent`}
              aria-label={tr("Próximo slide", "Next slide")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-2 shrink-0">
        {safeIndex + 1} {tr("de", "of")} {slides.length}
        {currentSlide.mediaType === "video" ? tr(" · vídeo", " · video") : ""}
        {attachmentType === "carousel" ? tr(" · carrossel", " · carousel") : ""}
      </p>
    </div>
  );
}
