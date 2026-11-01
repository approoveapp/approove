import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SessionProvider } from "@/components/session-provider";
import { LocaleProvider } from "@/components/locale-provider";
import { getRequestLocale } from "@/lib/request-locale";
import { getAppBaseUrl } from "@/lib/app-url";
import { AnalyticsRouteTracker } from "@/components/analytics-route-tracker";
import { GoogleAnalytics } from "@/components/google-analytics";
import { CookieConsent } from "@/components/cookie-consent";

const inter = Inter({ subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();

  return {
    metadataBase: new URL(getAppBaseUrl()),
    ...(locale === "pt-BR"
      ? {
          title: "Approove - Aprovação de conteúdo para social media e agências",
          description:
            "Envie o conteúdo para o cliente aprovar por um link e registre exatamente qual versão foi aprovada.",
        }
      : {
          title: "Approove - Client approval for social media managers and agencies",
          description:
            "Send content to clients for approval with one link, and keep a record of exactly which version they approved.",
        }),
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <GoogleAnalytics />
        <LocaleProvider locale={locale}>
          <SessionProvider>
            <ThemeProvider
              attribute="class"
              defaultTheme="light"
              enableSystem
              disableTransitionOnChange
            >
              {children}
              <CookieConsent />
              <Suspense fallback={null}>
                <AnalyticsRouteTracker />
              </Suspense>
            </ThemeProvider>
          </SessionProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
