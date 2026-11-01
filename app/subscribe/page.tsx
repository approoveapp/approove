import { redirect } from "next/navigation";
import { requireOrganization } from "@/lib/auth";
import { redirectForAuthError } from "@/lib/auth-redirect";
import { shouldRedirectFromSubscribe, subscribeCopyKind } from "@/lib/billing-access";
import { getRequestLocale } from "@/lib/request-locale";
import { foundingOfferLabel, getFoundingOffer } from "@/lib/founding-offer";
import { SubscribePlans } from "./subscribe-plans";

export default async function SubscribePage() {
  let context;

  try {
    context = await requireOrganization();
  } catch (error) {
    redirectForAuthError(error);
  }

  const { membership, organization } = context;

  if (shouldRedirectFromSubscribe(organization)) {
    redirect("/dashboard");
  }

  const locale = await getRequestLocale();
  const canManageBilling =
    membership.role === "owner" || membership.role === "admin";
  const foundingOffer = await getFoundingOffer();

  return (
    <SubscribePlans
      locale={locale}
      organizationName={organization.name}
      canManageBilling={canManageBilling}
      copyKind={subscribeCopyKind(organization)}
      foundingOffer={foundingOffer ? foundingOfferLabel(foundingOffer, locale) : null}
    />
  );
}
