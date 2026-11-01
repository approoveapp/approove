import { LandingJsonLd } from "@/components/landing/json-ld";
import { MarketingPageIntro } from "@/components/landing/page-intro";
import { LandingPricing } from "@/components/landing/pricing";
import { MarketingShell } from "@/components/landing/shell";
import { getAppBaseUrl } from "@/lib/app-url";
import { getFoundingOffer } from "@/lib/founding-offer";
import { importFeatureEnabled } from "@/lib/import/feature";
import { marketingPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return marketingPageMetadata({
    locale: "pt-BR",
    baseUrl: getAppBaseUrl(),
    pathPt: "/precos",
    pathEn: "/en/pricing",
    titlePt: "Preços - Approove",
    titleEn: "Approove pricing | Agency content approval plans",
    descriptionPt:
      "Planos Solo, Starter, Pro e Studio para aprovação de conteúdo. 15 dias grátis, sem cartão. Publicações ilimitadas.",
    descriptionEn:
      "Approove pricing for agency content approval. Solo, Starter, Pro, and Studio plans. 15-day trial, no credit card. Unlimited posts.",
  });
}

export default async function PrecosPage() {
  const aiImport = importFeatureEnabled();
  const foundingOffer = await getFoundingOffer();

  return (
    <MarketingShell locale="pt-BR" page="pricing" aiImport={aiImport}>
      <LandingJsonLd locale="pt-BR" aiImport={aiImport} includeFaq={false} />
      <MarketingPageIntro
        eyebrow="Preços"
        title="Planos da aprovação de conteúdo para agências"
        description="15 dias grátis, sem cartão. Os limites crescem com a carteira de clientes, usuários da agência e revisores. Publicações são ilimitadas em todos os planos."
      />
      <LandingPricing locale="pt-BR" showHeader={false} aiImport={aiImport} foundingOffer={foundingOffer} />
    </MarketingShell>
  );
}
