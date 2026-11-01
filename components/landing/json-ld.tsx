import { getLandingFaqs } from "@/components/landing/faq";
import { getAppBaseUrl } from "@/lib/app-url";
import { localizedText, type AppLocale } from "@/lib/locale";

export function LandingJsonLd({ locale, aiImport }: { locale: AppLocale; aiImport: boolean }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const base = getAppBaseUrl();
  const faqs = getLandingFaqs(locale, aiImport);

  const graph = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "SoftwareApplication",
        name: "Approove",
        url: base,
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: tr(
          "Aprovação de conteúdo para social media e agências. Calendário editorial, revisão do cliente por link e registro de qual versão foi aprovada.",
          "Client content approval for social media managers and agencies. Editorial calendar, client review by link, and a record of which version was approved."
        ),
      },
      {
        "@type": "WebSite",
        name: "Approove",
        url: base,
        inLanguage: locale === "pt-BR" ? "pt-BR" : "en",
      },
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
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
