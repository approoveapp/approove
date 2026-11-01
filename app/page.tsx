import type { Metadata } from "next";
import { LandingPage } from "@/components/landing-page";
import { LandingJsonLd } from "@/components/landing/json-ld";
import { getAppBaseUrl } from "@/lib/app-url";
import { getFoundingOffer } from "@/lib/founding-offer";
import { importFeatureEnabled } from "@/lib/import/feature";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const canonical = `${getAppBaseUrl()}/`;
  const isPt = locale === "pt-BR";

  const title = isPt
    ? "Approove - Aprovação de conteúdo para social media e agências"
    : "Approove - Client approval for social media managers and agencies";
  const description = isPt
    ? "Envie o conteúdo para o cliente aprovar por um link, sem login, e saiba exatamente qual versão foi aprovada. Mudou a arte ou a legenda? A aprovação volta para o cliente."
    : "Send content to clients for approval with one link, no login, and know exactly which version they approved. Change the creative or caption, and the approval resets.";

  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { en: `${canonical}?lang=en`, "pt-BR": `${canonical}?lang=pt` },
    },
    openGraph: {
      type: "website",
      url: canonical,
      siteName: "Approove",
      title,
      description,
      locale: isPt ? "pt_BR" : "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function Home() {
  const locale = await getRequestLocale();
  const options = { aiImport: importFeatureEnabled(), foundingOffer: await getFoundingOffer() };

  return (
    <>
      <LandingJsonLd locale={locale} aiImport={options.aiImport} />
      <LandingPage locale={locale} options={options} />
    </>
  );
}
