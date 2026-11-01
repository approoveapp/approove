export const SUPPORTED_LOCALES = ["en", "pt-BR"] as const;

export type AppLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: AppLocale = "en";

/** Language the visitor picked (switcher or `?lang=`); it wins over country and browser. */
export const LOCALE_COOKIE = "approove-locale";

export function parseLocale(value: string | null | undefined): AppLocale | null {
  const normalized = value?.trim().toLowerCase();
  if (normalized === "en") return "en";
  if (normalized === "pt" || normalized === "pt-br") return "pt-BR";
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
