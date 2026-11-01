import { LandingClientExperience } from "@/components/landing/client-experience";
import { HowToJsonLd } from "@/components/landing/how-to-json-ld";
import { LandingIntegrity, LandingRoles } from "@/components/landing/integrity";
import { MarketingPageIntro } from "@/components/landing/page-intro";
import { MarketingShell } from "@/components/landing/shell";
import { LandingWorkflow } from "@/components/landing/workflow";
import { getAppBaseUrl } from "@/lib/app-url";
import { importFeatureEnabled } from "@/lib/import/feature";
import { marketingPageMetadata } from "@/lib/seo";

export function generateMetadata() {
  return marketingPageMetadata({
    locale: "pt-BR",
    baseUrl: getAppBaseUrl(),
    pathPt: "/como-funciona",
    pathEn: "/en/how-it-works",
    titlePt: "Como funciona - Approove",
    titleEn: "How client content approval works | Approove",
    descriptionPt:
      "A agência organiza o calendário, libera só o que está pronto e o cliente aprova pelo link. O Approove registra quem aprovou, quando e em qual versão.",
    descriptionEn:
      "How client content approval works: the agency organizes the calendar, releases only what is ready, and the client reviews by link. Approove records who approved, when, and which version.",
  });
}

export default function ComoFuncionaPage() {
  return (
    <MarketingShell locale="pt-BR" page="how" aiImport={importFeatureEnabled()}>
      <HowToJsonLd locale="pt-BR" />
      <MarketingPageIntro
        eyebrow="Como funciona"
        title="Como funciona a aprovação de conteúdo no Approove"
        description="A equipe produz fora da vista do cliente. Quando o post está pronto, o cliente abre um link, comenta, marca pontos na arte e aprova. A decisão fica registrada na versão vigente da arte e da legenda."
      />
      <LandingWorkflow locale="pt-BR" />
      <LandingClientExperience locale="pt-BR" />
      <LandingIntegrity locale="pt-BR" />
      <LandingRoles locale="pt-BR" />
    </MarketingShell>
  );
}
