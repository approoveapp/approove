import { Film } from "lucide-react";
import { isVideoUrl } from "@/lib/media-utils";
import { cn } from "@/lib/utils";

/** Miniatura de material: vídeo mostra o primeiro quadro (um <img> de vídeo quebra). */
export function MediaThumb({ url, alt, className }: { url: string; alt: string; className?: string }) {
  if (isVideoUrl(url)) {
    return (
      <span className={cn("relative block overflow-hidden", className)}>
        <video src={url} muted playsInline preload="metadata" aria-label={alt} className="h-full w-full object-cover" />
        <Film className="absolute bottom-0.5 left-0.5 h-3.5 w-3.5 text-white drop-shadow" />
      </span>
    );
  }
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} />;
}
