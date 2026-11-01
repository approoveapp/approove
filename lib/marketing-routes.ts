import type { AppLocale } from "@/lib/locale";

export const MARKETING_PATHS = {
  home: { "pt-BR": "/", en: "/en" },
  how: { "pt-BR": "/como-funciona", en: "/en/how-it-works" },
  pricing: { "pt-BR": "/precos", en: "/en/pricing" },
} as const;

export type MarketingPage = keyof typeof MARKETING_PATHS;

export const PT_MARKETING_PATHS = [
  "/",
  "/termos",
  "/privacidade",
  "/precos",
  "/como-funciona",
] as const;

export function marketingPath(page: MarketingPage, locale: AppLocale): string {
  return MARKETING_PATHS[page][locale];
}
