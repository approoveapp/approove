import { LandingJsonLd } from "@/components/landing/json-ld";
import { MarketingPageIntro } from "@/components/landing/page-intro";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingPricingFaq } from "@/components/landing/pricing-faq";
import { MarketingShell } from "@/components/landing/shell";
import { getAppBaseUrl } from "@/lib/app-url";
import { getFoundingOffer } from "@/lib/founding-offer";
import { importFeatureEnabled } from "@/lib/import/feature";
import { marketingPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return marketingPageMetadata({
    locale: "en",
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

export default async function PricingPage() {
  const aiImport = importFeatureEnabled();
  const foundingOffer = await getFoundingOffer();

  return (
    <MarketingShell locale="en" page="pricing" aiImport={aiImport}>
      <LandingJsonLd locale="en" aiImport={aiImport} includeFaq={false} />
      <MarketingPageIntro
        eyebrow="Pricing"
        title="Plans for agency content approval"
        description="15 days free, no credit card. Limits grow with your client roster, agency seats, and reviewers. Posts are unlimited on every plan."
      />
      <LandingPricing locale="en" showHeader={false} aiImport={aiImport} foundingOffer={foundingOffer} />
      <LandingPricingFaq />
    </MarketingShell>
  );
}
