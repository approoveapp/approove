import { NextResponse } from "next/server";
import { localizedText } from "@/lib/locale";
import { getRequestLocale } from "@/lib/request-locale";
import { requireOrganization } from "@/lib/auth";
import { absoluteUrl } from "@/lib/app-url";
import { getStripe } from "@/lib/stripe";

export async function POST() {
  const locale = await getRequestLocale();
  try {
    const { membership, organization } = await requireOrganization();

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Sem permissão para gerenciar cobrança",
            "You don't have permission to manage billing."
          ),
        },
        { status: 403 }
      );
    }

    if (!organization.stripeCustomerId) {
      return NextResponse.json(
        {
          error: localizedText(
            locale,
            "Cliente Stripe ainda não existe",
            "No Stripe customer exists yet."
          ),
        },
        { status: 400 }
      );
    }

    const session = await getStripe().billingPortal.sessions.create({
      customer: organization.stripeCustomerId,
      configuration: process.env.STRIPE_PORTAL_CONFIGURATION_ID || undefined,
      return_url: absoluteUrl("/dashboard/settings"),
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Error creating billing portal session:", error);
    return NextResponse.json(
      { error: localizedText(locale, "Erro interno do servidor", "Internal server error.") },
      { status: 500 }
    );
  }
}
