import { ImageResponse } from "next/og";
import type { AppLocale } from "@/lib/locale";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

export function brandOpenGraphImage(locale: AppLocale) {
  const isPt = locale === "pt-BR";
  const headline = isPt
    ? "Aprovação de conteúdo para agências"
    : "Content approval for agencies";
  const sub = isPt
    ? "Calendário editorial. Revisão do cliente. Registro do que foi aprovado."
    : "Editorial calendar. Client review. A record of what was approved.";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#F4E9E1",
          color: "#1B1917",
          padding: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            fontSize: 36,
            fontWeight: 800,
            letterSpacing: "-0.06em",
          }}
        >
          Approove
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              display: "flex",
              fontSize: 64,
              fontWeight: 800,
              lineHeight: 1.05,
              letterSpacing: "-0.045em",
              maxWidth: 980,
            }}
          >
            {headline}
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 28,
              opacity: 0.7,
              maxWidth: 860,
            }}
          >
            {sub}
          </div>
        </div>
      </div>
    ),
    OG_SIZE
  );
}
