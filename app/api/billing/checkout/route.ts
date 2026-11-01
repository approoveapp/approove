import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { z } from "zod";
import { requireOrganization } from "@/lib/auth";
import { absoluteUrl } from "@/lib/app-url";
import { prisma } from "@/lib/prisma";
import { getStripe } from "@/lib/stripe";
import { currencyForLocale } from "@/lib/pricing";
import { getRequestLocale } from "@/lib/request-locale";
import { localizedText } from "@/lib/locale";
import { hasLiveSubscription } from "@/lib/billing-access";
import { apiErrorResponse } from "@/lib/api-error";
import { foundingCouponForCheckout } from "@/lib/founding-offer";

function isCurrencyMismatch(error: unknown) {
  return (
    error instanceof Stripe.errors.StripeInvalidRequestError &&
    /currency/i.test(error.message)
  );
}

const checkoutSchema = z.object({
  plan: z.enum(["solo", "starter", "pro", "studio"]),
  from: z.enum(["paywall", "settings"]).default("settings"),
});

const priceByPlan = {
  solo: process.env.STRIPE_PRICE_SOLO,
  starter: process.env.STRIPE_PRICE_STARTER,
  pro: process.env.STRIPE_PRICE_PRO,
  studio: process.env.STRIPE_PRICE_STUDIO,
} as const;

export async function POST(request: NextRequest) {
  try {
    const { membership, organization, user } = await requireOrganization();

    const locale = await getRequestLocale();
    const tr = (pt: string, en: string) => localizedText(locale, pt, en);

    if (membership.role !== "owner" && membership.role !== "admin") {
      return NextResponse.json(
        { error: tr("Sem permissão para gerenciar cobrança", "You don't have permission to manage billing") },
        { status: 403 }
      );
    }

    const { plan, from } = checkoutSchema.parse(await request.json());

    // Mudança de plano de quem já assina vai pelo Portal; um segundo Checkout criaria
    // duas assinaturas cobrando em paralelo.
    if (hasLiveSubscription(organization)) {
      return NextResponse.json(
        {
          error: tr(
            "Sua assinatura já está ativa. Altere o plano em Gerenciar assinatura.",
            "Your subscription is already active. Change your plan in Manage subscription."
          ),
        },
        { status: 409 }
      );
    }
    const price = priceByPlan[plan];

    if (!price) {
      return NextResponse.json(
        { error: tr("Preço Stripe não configurado", "Stripe price is not configured") },
        { status: 500 }
      );
    }

    const stripe = getStripe();
    let stripeCustomerId = organization.stripeCustomerId;

    if (!stripeCustomerId) {
      // Chave de idempotência: requisições simultâneas recebem o mesmo customer.
      const customer = await stripe.customers.create(
        {
          email: user.email ?? undefined,
          name: organization.name,
          metadata: { app: "approove", organizationId: organization.id },
        },
        { idempotencyKey: `approove-customer-${organization.id}` }
      );

      await prisma.organization.updateMany({
        where: { id: organization.id, stripeCustomerId: null },
        data: { stripeCustomerId: customer.id },
      });

      const saved = await prisma.organization.findUnique({
        where: { id: organization.id },
        select: { stripeCustomerId: true },
      });
      stripeCustomerId = saved?.stripeCustomerId ?? customer.id;
    }

    const currency = currencyForLocale(locale);

    const params: Stripe.Checkout.SessionCreateParams = {
      mode: "subscription",
      locale: "auto",
      currency,
      customer: stripeCustomerId,
      line_items: [{ price, quantity: 1 }],
      success_url: absoluteUrl(
        "/api/billing/confirm?session_id={CHECKOUT_SESSION_ID}"
      ),
      cancel_url: absoluteUrl(
        from === "paywall" ? "/subscribe" : "/dashboard/settings?billing=cancelled"
      ),
      metadata: { app: "approove", organizationId: organization.id, plan, from },
      subscription_data: {
        metadata: { app: "approove", organizationId: organization.id, plan },
      },
    };

    const foundingCoupon = await foundingCouponForCheckout();
    if (foundingCoupon) {
      params.discounts = [{ coupon: foundingCoupon }];
      params.metadata = { ...params.metadata, offer: "founding" };
    }

    let session;

    try {
      session = await stripe.checkout.sessions.create(params);
    } catch (error) {
      if (!isCurrencyMismatch(error)) throw error;

      session = await stripe.checkout.sessions.create({
        ...params,
        currency: undefined,
      });
    }

    return NextResponse.json({ url: session.url });
  } catch (error) {
    const handled = apiErrorResponse(error);
    if (handled) return handled;
    console.error("Error creating checkout session:", error);
    return NextResponse.json(
      { error: "Erro interno do servidor" },
      { status: 500 }
    );
  }
}
