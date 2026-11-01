"use client";

import { useState, useRef, useCallback } from "react";
import { Upload, X, Loader2, ImageIcon, Film } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText } from "@/lib/locale";
import {
  inferMediaType,
  isVideoMime,
  isVideoUrl,
  MEDIA_UPLOAD_ACCEPT,
  type MediaType,
} from "@/lib/media-utils";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string | null, mediaType?: MediaType) => void;
  label?: string;
  className?: string;
  aspectRatio?: "square" | "story" | "auto";
  compact?: boolean;
  dense?: boolean;
  allowVideo?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  label,
  className,
  aspectRatio = "auto",
  compact = false,
  dense = false,
  allowVideo = false,
}: ImageUploadProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const aspectClass =
    aspectRatio === "square"
      ? dense
        ? "aspect-square w-full max-w-[120px] max-h-[120px] mx-auto"
        : compact
        ? "aspect-square w-full max-w-[200px] max-h-[200px] mx-auto"
        : "aspect-square w-full max-w-[280px] max-h-[280px] mx-auto"
      : aspectRatio === "story"
        ? dense
          ? "aspect-[9/16] w-full max-w-[90px] max-h-[140px] mx-auto"
          : compact
          ? "aspect-[9/16] w-full max-w-[140px] max-h-[min(45vh,320px)] mx-auto"
          : "aspect-[9/16] w-full max-w-[180px] max-h-[min(50vh,360px)] mx-auto"
        : dense
          ? "aspect-video w-full max-h-[96px] mx-auto"
          : compact
          ? "aspect-video w-full max-h-[160px] mx-auto"
          : "aspect-video w-full max-h-[200px] mx-auto";

  const handleUpload = useCallback(
    async (file: File) => {
      setError("");
      setUploading(true);

      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || localizedText(locale, "Erro no upload", "Upload failed"));
        }

        const data = await response.json();
        const mediaType: MediaType = isVideoMime(file.type) ? "video" : inferMediaType(data.url);
        onChange(data.url, mediaType);
      } catch (err) {
        setError(err instanceof Error ? err.message : localizedText(locale, "Erro no upload", "Upload failed"));
      } finally {
        setUploading(false);
      }
    },
    [onChange, locale]
  );

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUpload(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = () => setDragOver(false);

  if (value) {
    const isVideo = allowVideo && isVideoUrl(value);
    return (
      <div className={cn("relative group", className)}>
        {label && (
          <p className="text-sm font-medium mb-2">{label}</p>
        )}
        <div className={cn("relative rounded-lg overflow-hidden border", aspectClass)}>
          {isVideo ? (
            <video src={value} controls playsInline className="w-full h-full object-cover" />
          ) : (
            <img
              src={value}
              alt="Upload"
              className="w-full h-full object-cover"
            />
          )}
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => onChange(null)}
            >
              <X className="h-4 w-4 mr-1" />
              {tr("Remover", "Remove")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      {label && (
        <p className="text-sm font-medium mb-2">{label}</p>
      )}
      <div
        onClick={() => inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          "rounded-lg border-2 border-dashed cursor-pointer transition-colors flex flex-col items-center justify-center gap-2",
          compact ? "p-4" : dense ? "p-3" : "p-6",
          aspectClass,
          dragOver
            ? "border-primary bg-primary/5"
            : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <>
            <Loader2 className={cn("animate-spin text-muted-foreground", compact ? "h-6 w-6" : "h-8 w-8")} />
            <p className="text-sm text-muted-foreground">{tr("Enviando...", "Uploading...")}</p>
          </>
        ) : (
          <>
            <div className={cn(
              "rounded-full bg-muted flex items-center justify-center",
              compact ? "h-8 w-8" : "h-10 w-10"
            )}>
              {dragOver ? (
                <Upload className={cn("text-primary", compact ? "h-4 w-4" : "h-5 w-5")} />
              ) : allowVideo ? (
                <Film className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-5 w-5")} />
              ) : (
                <ImageIcon className={cn("text-muted-foreground", compact ? "h-4 w-4" : "h-5 w-5")} />
              )}
            </div>
            <div className="text-center">
              <p className={cn("font-medium", compact ? "text-xs" : "text-sm")}>
                {dragOver ? tr("Solte aqui", "Drop here") : tr("Clique ou arraste", "Click or drag")}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {allowVideo
                  ? tr("PNG, JPG, GIF, WebP ou MP4 · máx. 50MB", "PNG, JPG, GIF, WebP or MP4 · max. 50MB")
                  : tr("PNG, JPG, GIF ou WebP · máx. 50MB", "PNG, JPG, GIF or WebP · max. 50MB")}
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-xs text-destructive mt-1">{error}</p>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={allowVideo ? MEDIA_UPLOAD_ACCEPT : "image/*"}
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  );
}
