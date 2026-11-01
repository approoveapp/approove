import "server-only";

import { unstable_cache } from "next/cache";
import { getStripe } from "@/lib/stripe";

/**
 * Founding-customer offer: a Stripe coupon applied automatically at checkout.
 * It is off unless STRIPE_FOUNDING_COUPON_ID is set. The coupon itself holds the
 * discount, its duration and the number of spots (max_redemptions), so ending the
 * offer is a Stripe change, or unsetting the env var.
 */
export function foundingCouponId() {
  return process.env.STRIPE_FOUNDING_COUPON_ID?.trim() || null;
}

export type FoundingOffer = {
  percentOff: number;
  /** "forever", or the number of months the discount lasts. */
  duration: "forever" | number;
  spotsTotal: number | null;
  spotsLeft: number | null;
};

async function loadFoundingOffer(couponId: string): Promise<FoundingOffer | null> {
  try {
    const coupon = await getStripe().coupons.retrieve(couponId);
    if (!coupon.valid || !coupon.percent_off) return null;

    const duration =
      coupon.duration === "forever"
        ? "forever"
        : coupon.duration === "repeating" && coupon.duration_in_months
          ? coupon.duration_in_months
          : 1;
    const spotsTotal = coupon.max_redemptions ?? null;
    const spotsLeft = spotsTotal === null ? null : Math.max(0, spotsTotal - coupon.times_redeemed);
    if (spotsLeft === 0) return null;

    return { percentOff: coupon.percent_off, duration, spotsTotal, spotsLeft };
  } catch (error) {
    // Hide the offer rather than break the page when Stripe is unreachable or misconfigured.
    console.error("Founding offer unavailable:", error instanceof Error ? error.message : error);
    return null;
  }
}

const cachedFoundingOffer = unstable_cache(loadFoundingOffer, ["founding-offer"], { revalidate: 600 });

/** The offer as shown on the site, refreshed every 10 minutes. */
export async function getFoundingOffer(): Promise<FoundingOffer | null> {
  const couponId = foundingCouponId();
  return couponId ? cachedFoundingOffer(couponId) : null;
}

/** Coupon to apply to a new checkout, checked live so a used-up coupon never blocks payment. */
export async function foundingCouponForCheckout(): Promise<string | null> {
  const couponId = foundingCouponId();
  if (!couponId) return null;
  const offer = await loadFoundingOffer(couponId);
  return offer ? couponId : null;
}

export function foundingOfferLabel(offer: FoundingOffer, locale: "en" | "pt-BR") {
  const pt = locale === "pt-BR";
  const when =
    offer.duration === "forever"
      ? pt ? "para sempre" : "for life"
      : offer.duration === 1
        ? pt ? "no primeiro mês" : "on your first month"
        : pt ? `por ${offer.duration} meses` : `for ${offer.duration} months`;
  const headline = pt
    ? `Oferta de fundador: ${offer.percentOff}% off ${when}`
    : `Founding offer: ${offer.percentOff}% off ${when}`;
  const spots =
    offer.spotsLeft === null || offer.spotsTotal === null
      ? null
      : pt
        ? `${offer.spotsLeft} de ${offer.spotsTotal} vagas restantes`
        : `${offer.spotsLeft} of ${offer.spotsTotal} spots left`;
  return { headline, spots };
}
