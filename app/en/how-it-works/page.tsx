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
    locale: "en",
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

export default function HowItWorksPage() {
  return (
    <MarketingShell locale="en" page="how" aiImport={importFeatureEnabled()}>
      <HowToJsonLd locale="en" />
      <MarketingPageIntro
        eyebrow="How it works"
        title="How content approval works in Approove"
        description="The team produces out of the client's sight. When a post is ready, the client opens a link, comments, pins points on the creative, and approves. The decision is recorded against the current creative and caption."
      />
      <LandingWorkflow locale="en" />
      <LandingClientExperience locale="en" />
      <LandingIntegrity locale="en" />
      <LandingRoles locale="en" />
    </MarketingShell>
  );
}
