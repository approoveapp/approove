import { importFeatureEnabled } from "@/lib/import/feature";
import { boundedImportFormData } from "@/lib/import/request";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { enforceRateLimit } from "@/lib/rate-limit";
import { sniffMedia } from "@/lib/file-sniff";
import { isMediaStorageConfigured, storeMedia } from "@/lib/media-storage";
import { canSignImportMedia, signImportMedia } from "@/lib/import/media-receipt";
import type { ImportMedia } from "@/lib/import/proposal";
import { importMediaPathname } from "@/lib/import/media";

/** Uma mídia por requisição: o corpo de função na Vercel tem teto de 4,5 MB. */
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

/**
 * Grava uma arte (imagem ou vídeo) antes da importação. A URL devolvida vai no
 * pedido de importação e, se a IA associar a um post, vira material dele no commit.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ clientSlug: string }> }
) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  try {
    const { user, organization } = await requireActiveOrganization();
    const { clientSlug } = await params;

    if (!importFeatureEnabled() || !isMediaStorageConfigured() || !canSignImportMedia()) {
      return NextResponse.json(
        { error: tr("Upload privado indisponível. Contate o administrador.", "Private upload is unavailable. Contact your administrator.") },
        { status: 503 }
      );
    }

    await enforceRateLimit("uploadUser", user.id);

    const client = await prisma.client.findFirst({
      where: { slug: clientSlug, organizationId: organization.id },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json({ error: tr("Cliente não encontrado", "Client not found") }, { status: 404 });
    }

    if (Number(request.headers.get("content-length") ?? 0) > MAX_MEDIA_BYTES + 64 * 1024) {
      return NextResponse.json({ error: tr("Máximo de 4 MB por imagem ou vídeo.", "Maximum of 4 MB per image or video.") }, { status: 413 });
    }
    const formData = await boundedImportFormData(request, MAX_MEDIA_BYTES + 64 * 1024, locale);
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: tr("Arquivo obrigatório", "File is required") }, { status: 400 });
    }
    if (file.size > MAX_MEDIA_BYTES) {
      return NextResponse.json(
        { error: tr(`"${file.name}": máximo de 4 MB por imagem ou vídeo.`, `"${file.name}": maximum of 4 MB per image or video.`) },
        { status: 413 }
      );
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = sniffMedia(bytes);
    if (!media) {
      return NextResponse.json(
        { error: tr(`"${file.name}": use imagens (JPEG, PNG, GIF, WebP) ou vídeos (MP4, MOV).`, `"${file.name}": use images (JPEG, PNG, GIF, WebP) or videos (MP4, MOV).`) },
        { status: 400 }
      );
    }

    const url = await storeMedia(importMediaPathname(organization.id, media.ext), bytes, media.mime);

    const uploaded: ImportMedia = {
      name: file.name.trim().slice(0, 200) || "midia",
      url,
      mediaType: media.mime.startsWith("video/") ? "video" : "image",
      mime: media.mime,
      size: file.size,
    };
    return NextResponse.json({ media: { ...uploaded, receipt: signImportMedia(uploaded, organization.id, client.id) } });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    console.error("Import media upload error:");
    return NextResponse.json({ error: tr("Erro ao enviar a mídia", "Error uploading the media") }, { status: 500 });
  }
}
