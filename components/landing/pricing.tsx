import Link from "next/link";
import { Check } from "lucide-react";
import { Reveal } from "@/components/landing/reveal";
import { MaskedWords } from "@/components/landing/masked-words";
import { Eyebrow, SectionHeading, TrialNote } from "@/components/landing/ui";
import { blue, cream, green, ink } from "@/components/landing/tokens";
import { PLAN_LIMITS } from "@/lib/plan-limits";
import { localizedText, type AppLocale } from "@/lib/locale";
import { planPrice, type PaidPlan } from "@/lib/pricing";
import type { FoundingOffer } from "@/lib/founding-offer";
import { FoundingOfferNote } from "@/components/landing/hero";

const planOrder = ["solo", "starter", "pro", "studio"] as const;

function planPricing(locale: AppLocale): Record<string, { price: string; period?: string }> {
  const paid = (plan: PaidPlan) => planPrice(plan, locale);
  return {
    solo: paid("solo"),
    starter: paid("starter"),
    pro: paid("pro"),
    studio: paid("studio"),
  };
}

function limitLabel(value: number | null, singular: string, plural: string, unlimitedLabel: string) {
  if (value === null) return unlimitedLabel;
  return `${value} ${value === 1 ? singular : plural}`;
}

export function LandingPricing({
  locale,
  aiImport,
  foundingOffer,
}: {
  locale: AppLocale;
  aiImport: boolean;
  foundingOffer: FoundingOffer | null;
}) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const pricingByPlan = planPricing(locale);
  const planCopy: Record<(typeof planOrder)[number], { name: string; description: string; highlighted?: boolean }> = {
    solo: { name: "Solo", description: tr("Para freelancers com os primeiros clientes", "For freelancers with their first clients") },
    starter: { name: "Starter", description: tr("Para uma carteira em formação", "For a client roster taking shape") },
    pro: { name: "Pro", description: tr("Para agências em crescimento", "For growing agencies"), highlighted: true },
    studio: { name: "Studio", description: tr("Para operações com muitos clientes", "For operations with many clients") },
  };

  return (
    <section id="precos" className="scroll-mt-16">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Eyebrow>{tr("Preços", "Pricing")}</Eyebrow>
        <Reveal bare>
          <SectionHeading>
            <MaskedWords text={tr("Planos que crescem com a sua carteira.", "Plans that grow with your client roster.")} />
          </SectionHeading>
        </Reveal>
        <p className="mt-6 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(27,25,23,0.6)" }}>
          {tr(
            "Preço pelo número de clientes, não por usuário. Revisores ilimitados em todos os planos.",
            "Priced by number of clients, not per seat. Unlimited reviewers on every plan."
          )}
        </p>
        <div className="mt-4">
          <TrialNote>
            {tr("15 dias grátis · sem cartão", "15 days free · no credit card")}
          </TrialNote>
          {foundingOffer && (
            <div>
              <FoundingOfferNote locale={locale} offer={foundingOffer} />
              <p className="mt-2 text-sm font-medium" style={{ color: "rgba(27,25,23,0.55)" }}>
                {tr(
                  "O desconto entra automaticamente quando você assina, em qualquer plano.",
                  "The discount applies automatically when you subscribe, on any plan."
                )}
              </p>
            </div>
          )}
        </div>
        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {planOrder.map((plan, i) => {
            const { name, description, highlighted } = planCopy[plan];
            const limits = PLAN_LIMITS[plan];
            const pricing = pricingByPlan[plan];
            const items = [
              limitLabel(limits.clients, tr("cliente", "client"), tr("clientes", "clients"), tr("Clientes ilimitados", "Unlimited clients")),
              limitLabel(limits.members, tr("usuário da agência", "agency user"), tr("usuários da agência", "agency users"), tr("Usuários ilimitados", "Unlimited users")),
              limitLabel(limits.reviewers, tr("revisor", "reviewer"), tr("revisores", "reviewers"), tr("Revisores ilimitados", "Unlimited reviewers")),
              tr("Publicações ilimitadas", "Unlimited posts"),
              ...(aiImport && limits.aiImports !== null
                ? [
                    tr(
                      `${limits.aiImports} importações com IA por mês`,
                      `${limits.aiImports} AI imports per month`
                    ),
                  ]
                : []),
              tr("Aprovação por link", "Link-based approval"),
              tr("Etapas internas e papéis do cliente", "Internal stages and client roles"),
            ];

            return (
              <Reveal key={plan} delay={i * 70} className="h-full">
                <div
                  className="flex h-full flex-col rounded-3xl border p-7"
                  style={
                    highlighted
                      ? { backgroundColor: blue, borderColor: blue, color: "#fff" }
                      : { borderColor: "rgba(27,25,23,0.15)", backgroundColor: "#FDFAF6" }
                  }
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-extrabold tracking-tight">{name}</h3>
                    {highlighted && (
                      <span
                        className="rounded-full px-3 py-1 text-[10px] font-extrabold uppercase tracking-[0.15em]"
                        style={{ backgroundColor: cream, color: ink }}
                      >
                        {tr("Popular", "Popular")}
                      </span>
                    )}
                  </div>
                  <p
                    className="mt-1 text-sm font-medium"
                    style={{ color: highlighted ? "rgba(255,255,255,0.75)" : "rgba(27,25,23,0.55)" }}
                  >
                    {description}
                  </p>
                  <div className="mt-6 flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold tracking-[-0.03em]">{pricing.price}</span>
                    {pricing.period && (
                      <span
                        className="text-sm font-semibold"
                        style={{ color: highlighted ? "rgba(255,255,255,0.7)" : "rgba(27,25,23,0.5)" }}
                      >
                        {pricing.period}
                      </span>
                    )}
                  </div>
                  <ul className="mt-7 flex-1 space-y-2.5 text-sm font-medium">
                    {items.map((item) => (
                      <li key={item} className="flex items-start gap-2.5">
                        <Check className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={3} style={{ color: highlighted ? cream : green }} />
                        {item}
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/signup"
                    className={`mt-8 inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-bold transition-colors duration-300 ${
                      highlighted
                        ? "bg-[#F4E9E1] text-[#1B1917] hover:bg-[#1B1917] hover:text-[#F4E9E1]"
                        : "bg-[#1B1917] text-[#F4E9E1] hover:bg-[#0072E3] hover:text-white"
                    }`}
                  >
                    {tr("Testar grátis por 15 dias", "Try free for 15 days")}
                  </Link>
                </div>
              </Reveal>
            );
          })}
        </div>
        <p className="mt-10 text-sm font-medium" style={{ color: "rgba(27,25,23,0.55)" }}>
          {tr("Precisa de mais? O plano Enterprise tem clientes, usuários e revisores ilimitados - ", "Need more? Enterprise includes unlimited clients, users, and reviewers - ")}
          <a href="mailto:contato@approove.app" className="font-bold underline underline-offset-4" style={{ color: ink }}>
            {tr("fale com a gente", "talk to us")}
          </a>
          .
        </p>
      </div>
    </section>
  );
}
