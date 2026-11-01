import "server-only";

import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, localeFromRequest, type AppLocale } from "@/lib/locale";

export async function getRequestLocale(): Promise<AppLocale> {
  const requestHeaders = await headers();
  const cookieStore = await cookies();

  return localeFromRequest({
    // The proxy forwards `?lang=` on the request that sets the cookie; later requests read the cookie.
    override: requestHeaders.get("x-approove-locale") ?? cookieStore.get(LOCALE_COOKIE)?.value,
    country:
      requestHeaders.get("x-approove-country") ??
      requestHeaders.get("x-vercel-ip-country") ??
      requestHeaders.get("cf-ipcountry"),
    acceptLanguage: requestHeaders.get("accept-language"),
  });
}
