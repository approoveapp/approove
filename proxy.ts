import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import {
  isAppLocale,
  LOCALE_COOKIE,
  marketingLocaleFromPath,
  parseLocale,
  persistableMarketingLocale,
} from "@/lib/locale";

function localeCookieOptions(req: NextRequest) {
  return {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax" as const,
    secure: req.nextUrl.protocol === "https:",
  };
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const authRoutes = ["/login", "/signup", "/forgot-password"];
  const isAuthRoute = authRoutes.includes(pathname);
  const protectedPrefixes = ["/dashboard", "/onboarding", "/convite"];
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (isAuthRoute || isProtected) {
    const token = await getToken({
      req,
      secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
      secureCookie: req.nextUrl.protocol === "https:",
    });
    const isLoggedIn = !!token;

    if (isAuthRoute && isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }

    if (isProtected && !isLoggedIn) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  const country =
    req.headers.get("x-vercel-ip-country") ??
    req.headers.get("cf-ipcountry");
  const requestHeaders = new Headers(req.headers);

  if (country) {
    requestHeaders.set("x-approove-country", country.toUpperCase());
  }
  requestHeaders.set("x-approove-pathname", pathname);

  // The marketing URL decides its own language; elsewhere `?lang=en|pt` (switcher, ad
  // links) wins over the saved cookie.
  const pathLocale = marketingLocaleFromPath(pathname);
  const chosenLocale = parseLocale(req.nextUrl.searchParams.get("lang"));
  const cookieLocale = req.cookies.get(LOCALE_COOKIE)?.value;
  const uiLocale = pathLocale ?? chosenLocale ?? (isAppLocale(cookieLocale) ? cookieLocale : null);

  if (uiLocale) {
    requestHeaders.set("x-approove-locale", uiLocale);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  const persist = persistableMarketingLocale(pathname) ?? chosenLocale;

  if (persist) {
    response.cookies.set(LOCALE_COOKIE, persist, localeCookieOptions(req));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|sitemap.xml|robots.txt|llms.txt).*)",
  ],
};
