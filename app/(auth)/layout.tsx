import type { Metadata } from "next";
import { headers } from "next/headers";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { authMetadataForPath } from "@/lib/seo";

export async function generateMetadata(): Promise<Metadata> {
  const pathname = (await headers()).get("x-approove-pathname") ?? "";
  const locale = await getRequestLocale();
  return authMetadataForPath(pathname, locale);
}

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getRequestLocale();
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const facts = [
    [
      tr("Link", "Link"),
      tr("O cliente revisa no navegador, sem criar conta no fluxo compartilhado.", "The client reviews in the browser, with no account on the shared-link flow."),
    ],
    [
      tr("Registro", "Record"),
      tr("Quem aprovou, quando e qual versão da arte e da legenda.", "Who approved, when, and which creative and caption version."),
    ],
    [
      tr("15 dias", "15 days"),
      tr("Teste grátis, sem cartão, para a agência começar a enviar calendários.", "Free trial, no credit card, so the agency can start sending calendars."),
    ],
  ];

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-primary p-10 text-primary-foreground">
        <p className="text-2xl font-bold">Approove</p>

        <div className="space-y-4">
          <p className="text-lg leading-relaxed opacity-90">
            {tr(
              "Espaço de aprovação de conteúdo para agências. Calendário editorial, revisão do cliente e registro do que foi aprovado.",
              "Content-approval workspace for agencies. Editorial calendar, client review, and a record of what was approved."
            )}
          </p>
        </div>

        <div className="grid gap-6 text-sm opacity-90">
          {facts.map(([label, detail]) => (
            <div key={label}>
              <p className="text-2xl font-bold opacity-100">{label}</p>
              <p className="mt-1 opacity-75">{detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center p-6 sm:p-10">
        <div className="w-full max-w-[420px]">{children}</div>
      </div>
    </div>
  );
}
