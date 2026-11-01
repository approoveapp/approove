export const SUPPORTED_LOCALES = ["en", "pt-BR"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Language the visitor picked (URL, switcher or `?lang=`); it wins over country and browser. */
export const LOCALE_COOKIE = "approove-locale";

export function isAppLocale(value: string | null | undefined): value is AppLocale {
  return value === "en" || value === "pt-BR";
}

/** Accepts the short forms used in `?lang=` (`en`, `pt`, `pt-br`). */
export function parseLocale(value: string | null | undefined): AppLocale | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "pt" || normalized === "pt-br") return "pt-BR";
  return null;
}

/**
 * Idioma travado pela URL pública. `/` e os legais são sempre pt-BR;
 * `/en` é sempre inglês. Rotas da app retornam null (geo ou cookie).
 */
export function marketingLocaleFromPath(pathname: string): AppLocale | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) {
    return "en";
  }

  if (
    pathname === "/" ||
    pathname === "/termos" ||
    pathname === "/privacidade" ||
    pathname === "/precos" ||
    pathname === "/como-funciona"
  ) {
    return "pt-BR";
  }

  return null;
}

/** Landing em PT/EN grava preferência. Legais em português não sobrescrevem `/en`. */
export function persistableMarketingLocale(pathname: string): AppLocale | null {
  if (pathname === "/en" || pathname.startsWith("/en/")) return "en";
  if (pathname === "/" || pathname === "/precos" || pathname === "/como-funciona") {
    return "pt-BR";
  }
  return null;
}

export function localeFromRequest({
  override,
  country,
  acceptLanguage,
}: {
  override?: string | null;
  country?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  const chosen = parseLocale(override);
  if (chosen) return chosen;

  const normalizedCountry = country?.trim().toUpperCase();

  if (normalizedCountry) {
    return normalizedCountry === "BR" ? "pt-BR" : DEFAULT_LOCALE;
  }

  const preferredLanguage = acceptLanguage
    ?.split(",")[0]
    ?.trim()
    .toLowerCase();

  return preferredLanguage?.startsWith("pt") ? "pt-BR" : DEFAULT_LOCALE;
}

export function isBrazilianLocale(locale: AppLocale) {
  return locale === "pt-BR";
}

export function localizedText(locale: AppLocale, portuguese: string, english: string) {
  return isBrazilianLocale(locale) ? portuguese : english;
}
