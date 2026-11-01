"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocale } from "@/components/locale-provider";
import { localizedText, type AppLocale } from "@/lib/locale";
import { inferMediaType, isVideoMime, MEDIA_UPLOAD_ACCEPT, type MediaType } from "@/lib/media-utils";

export interface UploadedMedia {
  url: string;
  mediaType: MediaType;
}

interface BatchMediaUploadProps {
  onUploaded: (files: UploadedMedia[]) => void;
  className?: string;
  label?: string;
}

async function uploadFile(file: File, locale: AppLocale): Promise<UploadedMedia> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/upload", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(typeof data.error === "string" ? data.error : localizedText(locale, "Erro no upload", "Upload failed"));
  }

  const data = await response.json();
  return {
    url: data.url,
    mediaType: isVideoMime(file.type) ? "video" : inferMediaType(data.url),
  };
}

export function BatchMediaUpload({
  onUploaded,
  className,
  label,
}: BatchMediaUploadProps) {
  const locale = useLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList).filter((file) => file.size > 0);
      if (files.length === 0) return;

      setError(null);
      setUploading(true);
      try {
        const results = await Promise.all(files.map((file) => uploadFile(file, locale)));
        onUploaded(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : localizedText(locale, "Erro no upload em lote", "Batch upload failed"));
      } finally {
        setUploading(false);
        if (inputRef.current) inputRef.current.value = "";
      }
    },
    [onUploaded, locale]
  );

  return (
    <div className={className}>
      <div
        onClick={() => !uploading && inputRef.current?.click()}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!uploading) void handleFiles(e.dataTransfer.files);
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        className={cn(
          "rounded-lg border-2 border-dashed p-4 text-center cursor-pointer transition-colors",
          dragOver ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-muted-foreground/50",
          uploading && "pointer-events-none opacity-60"
        )}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-2 py-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-xs text-muted-foreground">{tr("Enviando arquivos...", "Uploading files...")}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2">
            <Upload className="h-5 w-5 text-muted-foreground" />
            <p className="text-sm font-medium">{label ?? tr("Upload em lote", "Batch upload")}</p>
            <p className="text-xs text-muted-foreground">
              {tr(
                "Arraste várias imagens ou vídeos · PNG, JPG, MP4 · máx. 50MB cada",
                "Drag in multiple images or videos · PNG, JPG, MP4 · max. 50MB each"
              )}
            </p>
          </div>
        )}
      </div>
      {error && <p className="text-xs text-destructive mt-2">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept={MEDIA_UPLOAD_ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files) void handleFiles(e.target.files);
        }}
      />
    </div>
  );
}
