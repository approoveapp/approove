"use client";

import { Film, ImageIcon } from "lucide-react";
import { AnnotationLayer } from "./annotation-layer";
import type { AnnotationPin } from "@/lib/types";
import { isVideoUrl, type MediaType } from "@/lib/media-utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";

interface SlideMediaPreviewProps {
  url: string;
  mediaType?: MediaType;
  pins: AnnotationPin[];
  canAnnotate?: boolean;
  author?: "agency" | "client";
  onPinCreate?: (
    xPercent: number,
    yPercent: number,
    text: string,
    author: "agency" | "client"
  ) => void;
  onPinResolve?: (pinId: string, resolved: boolean) => void;
  onPinDelete?: (pinId: string) => void;
}

export function SlideMediaPreview({
  url,
  mediaType,
  pins,
  canAnnotate = false,
  author = "agency",
  onPinCreate,
  onPinResolve,
  onPinDelete,
}: SlideMediaPreviewProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const isVideo = mediaType === "video" || isVideoUrl(url);

  if (isVideo) {
    return (
      <div className="relative h-full w-full flex flex-col items-center justify-center bg-black/90 rounded-md overflow-hidden">
        <video
          src={url}
          controls
          playsInline
          className="max-h-full max-w-full w-full h-full object-contain"
        />
        <div className="absolute top-2 left-2 flex items-center gap-1 rounded bg-background/90 px-2 py-1 text-[10px] font-medium">
          <Film className="h-3 w-3" />
          {tr("Vídeo", "Video")}
        </div>
        <p className="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-white/70 bg-black/50 px-2 py-0.5 rounded">
          {tr("Pins disponíveis apenas em imagens", "Pins are only available on images")}
        </p>
      </div>
    );
  }

  return (
    <AnnotationLayer
      imageUrl={url}
      pins={pins}
      onPinCreate={onPinCreate}
      onPinResolve={onPinResolve}
      onPinDelete={onPinDelete}
      canAnnotate={canAnnotate}
      author={author}
    />
  );
}

export function SlideMediaThumb({ url, mediaType }: { url: string; mediaType?: MediaType }) {
  const locale = useLocale();
  const isVideo = mediaType === "video" || isVideoUrl(url);

  if (isVideo) {
    return (
      <div className="w-full h-full bg-muted rounded flex flex-col items-center justify-center gap-1">
        <Film className="h-5 w-5 text-muted-foreground" />
        <span className="text-[9px] text-muted-foreground">{localizedText(locale, "Vídeo", "Video")}</span>
      </div>
    );
  }

  if (url) {
    return <img src={url} alt="" className="w-full h-full object-cover rounded" />;
  }

  return (
    <div className="w-full h-full bg-muted rounded flex items-center justify-center">
      <ImageIcon className="h-5 w-5 text-muted-foreground" />
    </div>
  );
}
