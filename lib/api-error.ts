import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { localizedText, type AppLocale } from "@/lib/locale";
import { invalidDataMessage, localizeValidationMessage } from "@/lib/validation-messages";

/** Mensagem nos dois idiomas: helpers lançam sem saber o locale; a rota escolhe. */
export type LocalizedMessage = { pt: string; en: string };

/**
 * Locale usado quando a rota não informa o da requisição. Mantém o comportamento
 * anterior (português) para chamadas que ainda não passam `locale`.
 */
const FALLBACK_LOCALE: AppLocale = "pt-BR";

/** Erro com status HTTP. Lançar em helpers; `apiErrorResponse` converte na rota. */
export class ApiError extends Error {
  /** Versões da mensagem por idioma; `message` guarda o português. */
  public localized?: LocalizedMessage;

  constructor(
    public status: number,
    message: string | LocalizedMessage,
    public code?: string,
    public extra?: Record<string, unknown>,
    public headers?: Record<string, string>
  ) {
    super(typeof message === "string" ? message : message.pt);
    if (typeof message !== "string") this.localized = message;
  }

  messageFor(locale: AppLocale) {
    return this.localized ? localizedText(locale, this.localized.pt, this.localized.en) : this.message;
  }
}

export function isDatabaseUnavailable(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001") {
    return true;
  }
  if (error instanceof Error && error.message.includes("Can't reach database")) {
    return true;
  }
  return false;
}

export function databaseUnavailableResponse(locale: AppLocale = FALLBACK_LOCALE) {
  return {
    json: {
      error: localizedText(
        locale,
        "Banco de dados indisponível. Tente novamente em instantes.",
        "Database unavailable. Please try again in a moment."
      ),
    },
    status: 503 as const,
  };
}

/** Resposta para erros conhecidos; `null` quando a rota deve tratar/logar como 500. */
export function apiErrorResponse(
  error: unknown,
  locale: AppLocale = FALLBACK_LOCALE
): NextResponse | null {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.messageFor(locale), ...(error.code && { code: error.code }), ...error.extra },
      { status: error.status, headers: error.headers }
    );
  }
  if (error instanceof z.ZodError) {
    const message = error.issues[0]?.message;
    return NextResponse.json(
      { error: message ? localizeValidationMessage(message, locale) : invalidDataMessage(locale) },
      { status: 400 }
    );
  }
  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: localizedText(locale, "JSON inválido", "Invalid JSON.") },
      { status: 400 }
    );
  }
  if (error instanceof Error && error.message === "Unauthorized") {
    return NextResponse.json(
      { error: localizedText(locale, "Faça login para continuar", "Please sign in to continue.") },
      { status: 401 }
    );
  }
  if (error instanceof Error && error.message === "No organization") {
    return NextResponse.json(
      {
        error: localizedText(
          locale,
          "Nenhuma organização vinculada à sua conta",
          "No organization is linked to your account."
        ),
      },
      { status: 403 }
    );
  }
  if (isDatabaseUnavailable(error)) {
    const { json, status } = databaseUnavailableResponse(locale);
    return NextResponse.json(json, { status });
  }
  return null;
}
