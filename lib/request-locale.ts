import "server-only";

import { cookies, headers } from "next/headers";
import { isAppLocale, LOCALE_COOKIE, localeFromRequest, type AppLocale } from "@/lib/locale";

function geoLocaleFromHeaders(requestHeaders: Headers): AppLocale {
  return localeFromRequest({
    country:
      requestHeaders.get("x-approove-country") ??
      requestHeaders.get("x-vercel-ip-country") ??
      requestHeaders.get("cf-ipcountry"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}

/**
 * UI: marketing URL or `?lang=` (set by the proxy), then the saved cookie, then country /
 * Accept-Language. API routes skip the proxy, so the cookie is read here too.
 */
export async function getRequestLocale(): Promise<AppLocale> {
  const requestHeaders = await headers();
  const explicit = requestHeaders.get("x-approove-locale");

  if (isAppLocale(explicit)) {
    return explicit;
  }

  const saved = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isAppLocale(saved)) {
    return saved;
  }

  return geoLocaleFromHeaders(requestHeaders);
}

/** Cobrança: só geografia, para um brasileiro em `/en` continuar em BRL. */
export async function getBillingLocale(): Promise<AppLocale> {
  return geoLocaleFromHeaders(await headers());
}
