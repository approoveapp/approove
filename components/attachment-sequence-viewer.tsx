"use client";

import { useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Keyboard } from "swiper/modules";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { SlideMediaPreview } from "./slide-media-preview";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import {
  isSequenceAttachment,
  resolveVersionSlides,
  type AttachmentVersionRecord,
} from "@/lib/attachment-slides";

import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

interface AttachmentSequenceViewerProps {
  attachmentType: string;
  version: AttachmentVersionRecord;
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
      <div className="absolute inset-0 p-4">
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
    <div className="absolute inset-0 p-4 flex flex-col min-h-0">
      <div className="relative flex-1 min-h-0">
        <Swiper
          modules={[Navigation, Pagination, Keyboard]}
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
