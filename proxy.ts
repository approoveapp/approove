import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";
import { LOCALE_COOKIE, parseLocale } from "@/lib/locale";

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

  // `?lang=en|pt` (language switcher, ad links) pins the language for this and later visits.
  const chosenLocale = parseLocale(req.nextUrl.searchParams.get("lang"));
  if (chosenLocale) {
    requestHeaders.set("x-approove-locale", chosenLocale);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (chosenLocale) {
    response.cookies.set(LOCALE_COOKIE, chosenLocale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
    });
  }
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)"],
};
