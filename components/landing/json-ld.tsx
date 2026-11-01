import { getLandingFaqs } from "@/components/landing/faq";
import { getAppBaseUrl } from "@/lib/app-url";
import { localizedText, type AppLocale } from "@/lib/locale";
import { marketingPath } from "@/lib/marketing-routes";
import { currencyForLocale, PLAN_AMOUNTS, type PaidPlan } from "@/lib/pricing";

const PAID_PLANS: PaidPlan[] = ["solo", "starter", "pro", "studio"];
const PLAN_NAMES: Record<PaidPlan, string> = {
  solo: "Solo",
  starter: "Starter",
  pro: "Pro",
  studio: "Studio",
};

export function LandingJsonLd({
  locale,
  aiImport = false,
  includeFaq = true,
}: {
  locale: AppLocale;
  /** FAQ answers about AI import appear only while the feature is on. */
  aiImport?: boolean;
  includeFaq?: boolean;
}) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const base = getAppBaseUrl();
  const faqs = includeFaq ? getLandingFaqs(locale, aiImport) : [];
  const currency = currencyForLocale(locale);
  const pricingUrl = `${base}${marketingPath("pricing", locale)}`;
  const priceCurrency = currency.toUpperCase();
  const organizationId = `${base}/#organization`;
  const description = tr(
    "Aprovação de conteúdo para social media e agências. Calendário editorial, revisão do cliente por link e registro de qual versão foi aprovada.",
    "Client content approval for social media managers and agencies. Editorial calendar, client review by link, and a record of which version was approved."
  );

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Approove",
        url: base,
        email: "contato@approove.app",
        logo: `${base}/icon`,
      },
      {
        "@type": "SoftwareApplication",
        name: "Approove",
        url: base,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description,
        publisher: { "@id": organizationId },
        offers: [
          {
            "@type": "Offer",
            name: tr("Teste de 15 dias", "15-day trial"),
            price: "0",
            priceCurrency,
            description: tr("Sem cartão de crédito.", "No credit card."),
          },
          ...PAID_PLANS.map((plan) => ({
            "@type": "Offer",
            name: PLAN_NAMES[plan],
            price: (PLAN_AMOUNTS[plan][currency] / 100).toFixed(2),
            priceCurrency,
            url: pricingUrl,
          })),
        ],
      },
      {
        "@type": "WebSite",
        name: "Approove",
        url: base,
        inLanguage: locale === "pt-BR" ? "pt-BR" : "en",
        publisher: { "@id": organizationId },
      },
      ...(includeFaq
        ? [
            {
              "@type": "FAQPage",
              mainEntity: faqs.map((faq) => ({
                "@type": "Question",
                name: faq.question,
                acceptedAnswer: {
                  "@type": "Answer",
                  text: faq.answer,
                },
              })),
            },
          ]
        : []),
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
