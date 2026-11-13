import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
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

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
// Títulos do fluxo de importação e do calendário (classe `font-display`).
const display = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-display" });

export function generateMetadata(): Metadata {
  return {
    metadataBase: new URL(getAppBaseUrl()),
    applicationName: "Approove",
    title: {
      default: "Approove",
      template: "%s | Approove",
    },
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
      <body className={`${inter.className} ${inter.variable} ${display.variable}`}>
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
