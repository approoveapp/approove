import { LandingPage } from "@/components/landing-page";
import { LandingJsonLd } from "@/components/landing/json-ld";
import { getAppBaseUrl } from "@/lib/app-url";
import { getFoundingOffer } from "@/lib/founding-offer";
import { importFeatureEnabled } from "@/lib/import/feature";
import { marketingHomeMetadata } from "@/lib/seo";

export function generateMetadata() {
  return marketingHomeMetadata("pt-BR", getAppBaseUrl());
}

export default async function Home() {
  const options = { aiImport: importFeatureEnabled(), foundingOffer: await getFoundingOffer() };

  return (
    <>
      <LandingJsonLd locale="pt-BR" aiImport={options.aiImport} />
      <LandingPage locale="pt-BR" options={options} />
    </>
  );
}
