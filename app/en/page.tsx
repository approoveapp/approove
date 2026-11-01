import { LandingPage } from "@/components/landing-page";
import { LandingJsonLd } from "@/components/landing/json-ld";
import { getAppBaseUrl } from "@/lib/app-url";
import { getFoundingOffer } from "@/lib/founding-offer";
import { importFeatureEnabled } from "@/lib/import/feature";
import { marketingHomeMetadata } from "@/lib/seo";

export function generateMetadata() {
  return marketingHomeMetadata("en", getAppBaseUrl());
}

export default async function EnglishHome() {
  const options = { aiImport: importFeatureEnabled(), foundingOffer: await getFoundingOffer() };

  return (
    <>
      <LandingJsonLd locale="en" aiImport={options.aiImport} />
      <LandingPage locale="en" options={options} />
    </>
  );
}
