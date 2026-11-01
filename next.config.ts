import type { NextConfig } from "next";
import { NOINDEX_HEADER_SOURCES } from "./lib/seo";

const isDev = process.env.NODE_ENV !== "production";

// Mídia dos posts pode vir de qualquer link https colado pela agência, por isso
// img/media aceitam https:. Scripts só do próprio site e do Google Analytics.
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} https://*.googletagmanager.com`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com https://checkout.stripe.com https://billing.stripe.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: contentSecurityPolicy },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["exceljs", "mammoth"],
  outputFileTracingIncludes: { "/api/clients/*/imports": ["./node_modules/exceljs/**/*", "./node_modules/mammoth/**/*"] },
  // next/image não é usado: sem remotePatterns o otimizador não vira proxy aberto.
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      ...NOINDEX_HEADER_SOURCES.map((source) => ({
        source,
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
      })),
      {
        // Links de aprovação carregam o token na URL: não vazar via Referer.
        source: "/c/:path*",
        headers: [{ key: "Referrer-Policy", value: "no-referrer" }],
      },
    ];
  },
};

export default nextConfig;
