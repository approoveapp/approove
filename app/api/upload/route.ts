import { NextRequest, NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { put } from "@vercel/blob";
import { requireActiveOrganization } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/api-error";
import { randomToken } from "@/lib/crypto-tokens";
import { sniffMedia } from "@/lib/file-sniff";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_SIZE = 50 * 1024 * 1024; // 50MB

export async function POST(request: NextRequest) {
  const locale = await getRequestLocale();
  try {
    const { user, organization } = await requireActiveOrganization();

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Upload não configurado. Defina BLOB_READ_WRITE_TOKEN no .env (Vercel Blob).",
            "Upload isn't configured. Set BLOB_READ_WRITE_TOKEN in .env (Vercel Blob)."
          ),
        },
        { status: 503 }
      );
    }

    await enforceRateLimit("uploadUser", user.id);

    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: localizedText(locale, "Arquivo obrigatório", "File is required.") },
        { status: 400 }
      );
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Arquivo muito grande. Máximo: 50MB.",
            "File is too large. Maximum: 50MB."
          ),
        },
        { status: 400 }
      );
    }

    // O tipo vem dos bytes, não do navegador; nome e extensão são gerados aqui.
    const bytes = new Uint8Array(await file.arrayBuffer());
    const media = sniffMedia(bytes);

    if (!media) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Tipo de arquivo não permitido. Use imagens (JPEG, PNG, GIF, WebP) ou vídeos (MP4, MOV).",
            "File type not allowed. Use images (JPEG, PNG, GIF, WebP) or videos (MP4, MOV)."
          ),
        },
        { status: 400 }
      );
    }

    const pathname = `uploads/${organization.id}/${Date.now()}-${randomToken(9)}.${media.ext}`;

    const blob = await put(pathname, Buffer.from(bytes), {
      access: "public",
      contentType: media.mime,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    const handled = apiErrorResponse(error, locale);
    if (handled) return handled;
    if (
      error instanceof Error &&
      error.message.includes("Cannot use public access on a private store")
    ) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "O Blob Store está configurado como privado. Acesse vercel.com/dashboard/stores e altere para público, ou crie um novo store com acesso público.",
            "The Blob Store is set to private. Go to vercel.com/dashboard/stores and switch it to public, or create a new store with public access."
          ),
        },
        { status: 503 }
      );
    }
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Erro ao fazer upload do arquivo" },
      { status: 500 }
    );
  }
}
