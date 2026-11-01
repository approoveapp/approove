import { prisma } from "@/lib/prisma";
import { ApiError } from "@/lib/api-error";

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

/** Limites por ação. Janela fixa; contadores no banco valem para todas as instâncias. */
export const RATE_LIMITS = {
  loginIp: { limit: 30, windowMs: 15 * MINUTE },
  loginEmail: { limit: 10, windowMs: 15 * MINUTE },
  sendCodeIp: { limit: 10, windowMs: 15 * MINUTE },
  sendCodeEmail: { limit: 3, windowMs: 15 * MINUTE },
  forgotIp: { limit: 10, windowMs: HOUR },
  forgotEmail: { limit: 3, windowMs: HOUR },
  resetIp: { limit: 20, windowMs: HOUR },
  signupIp: { limit: 5, windowMs: HOUR },
  inviteOrg: { limit: 30, windowMs: HOUR },
  uploadUser: { limit: 120, windowMs: HOUR },
  importUser: { limit: 20, windowMs: HOUR },
  publicIp: { limit: 300, windowMs: 15 * MINUTE },
  publicWriteToken: { limit: 120, windowMs: 15 * MINUTE },
} as const;

export type RateLimitName = keyof typeof RATE_LIMITS;

export async function hitRateLimit(name: RateLimitName, subject: string) {
  const { limit, windowMs } = RATE_LIMITS[name];
  const key = `${name}:${subject}`;
  const now = Date.now();
  const resetAt = now + windowMs;

  // Upsert atômico: zera a janela vencida ou incrementa a atual. resetAt volta como
  // TEXT porque o adapter libsql do Prisma não decodifica colunas BIGINT em $queryRaw.
  const rows = await prisma.$queryRaw<Array<{ count: number | bigint; resetAt: string }>>`
    INSERT INTO "RateLimit" ("key", "count", "resetAt") VALUES (${key}, 1, ${resetAt})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN 1 ELSE "RateLimit"."count" + 1 END,
      "resetAt" = CASE WHEN "RateLimit"."resetAt" <= ${now} THEN ${resetAt} ELSE "RateLimit"."resetAt" END
    RETURNING "count", CAST("resetAt" AS TEXT) AS "resetAt"`;

  if (Math.random() < 0.01) {
    await prisma.$executeRaw`DELETE FROM "RateLimit" WHERE "resetAt" < ${now - HOUR}`;
  }

  const count = Number(rows[0]?.count ?? 1);
  const windowEnd = Number(rows[0]?.resetAt ?? resetAt);
  return {
    ok: count <= limit,
    retryAfterSeconds: Math.max(1, Math.ceil((windowEnd - now) / 1000)),
  };
}

/** Lança 429 quando o limite estoura. */
export async function enforceRateLimit(name: RateLimitName, subject: string) {
  const result = await hitRateLimit(name, subject);
  if (!result.ok) {
    throw new ApiError(
      429,
      {
        pt: "Muitas tentativas. Aguarde alguns minutos e tente novamente.",
        en: "Too many attempts. Wait a few minutes and try again.",
      },
      "RATE_LIMITED",
      undefined,
      { "Retry-After": String(result.retryAfterSeconds) }
    );
  }
}

/** IP do cliente. Na Vercel, x-real-ip/x-forwarded-for são definidos pela plataforma. */
export function clientIp(headers: Headers) {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}
