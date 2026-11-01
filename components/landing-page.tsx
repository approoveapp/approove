import { cream, ink } from "@/components/landing/tokens";
import { Preloader } from "@/components/landing/preloader";
import { LandingNavbar } from "@/components/landing/navbar";
import { LandingHero } from "@/components/landing/hero";
import { LandingMarquee, LandingProblem } from "@/components/landing/problem";
import { LandingAiImport } from "@/components/landing/ai-import";
import { LandingWorkflow } from "@/components/landing/workflow";
import { LandingClientExperience } from "@/components/landing/client-experience";
import {
  LandingActivity,
  LandingFeedback,
  LandingIntegrity,
  LandingInvalidation,
  LandingRoles,
  LandingVersions,
} from "@/components/landing/integrity";
import { LandingFeatures } from "@/components/landing/features";
import { LandingPricing } from "@/components/landing/pricing";
import { LandingFaq } from "@/components/landing/faq";
import { LandingFinalCta } from "@/components/landing/final-cta";
import type { FoundingOffer } from "@/lib/founding-offer";
import type { AppLocale } from "@/lib/locale";

export type LandingOptions = {
  /** AI import is advertised only while the feature is switched on (IMPORT_AI_ENABLED). */
  aiImport: boolean;
  foundingOffer: FoundingOffer | null;
};

/**
 * Order follows what a solo social media manager needs to believe first: how the
 * client approves, why that approval holds, then migration, then team features.
 */
export function LandingPage({ locale, options }: { locale: AppLocale; options: LandingOptions }) {
  return (
    <div className="lp flex min-h-screen flex-col antialiased" style={{ backgroundColor: cream, color: ink }}>
      <Preloader />
      <LandingNavbar locale={locale} aiImport={options.aiImport} />
      <main className="flex-1">
        <LandingHero locale={locale} foundingOffer={options.foundingOffer} />
        <LandingMarquee locale={locale} aiImport={options.aiImport} />
        <LandingProblem locale={locale} />
        <LandingClientExperience locale={locale} />
        <LandingIntegrity locale={locale} />
        <LandingInvalidation locale={locale} />
        <LandingActivity locale={locale} />
        <LandingFeedback locale={locale} />
        <LandingVersions locale={locale} />
        {options.aiImport && <LandingAiImport locale={locale} />}
        <LandingWorkflow locale={locale} />
        <LandingRoles locale={locale} />
        <LandingFeatures locale={locale} />
        <LandingPricing locale={locale} aiImport={options.aiImport} foundingOffer={options.foundingOffer} />
        <LandingFaq locale={locale} aiImport={options.aiImport} />
      </main>
      <LandingFinalCta locale={locale} />
    </div>
  );
}
