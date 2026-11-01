import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { cleanupImportMedia } from "@/lib/import/cleanup";

export const maxDuration = 60;

function authorized(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  // Sem segredo configurado a rota fica fechada: ninguém dispara a faxina de fora.
  if (!secret) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/** Chamado pelo Vercel Cron (vercel.json), que manda `Authorization: Bearer $CRON_SECRET`. */
export async function GET(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }
  try {
    return NextResponse.json(await cleanupImportMedia());
  } catch {
    console.error("Import cleanup cron failed");
    return NextResponse.json({ error: "Erro na limpeza" }, { status: 500 });
  }
}
