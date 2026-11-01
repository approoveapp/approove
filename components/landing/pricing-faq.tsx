import { Reveal } from "@/components/landing/reveal";
import { Eyebrow } from "@/components/landing/ui";

const PRICING_FAQS = [
  {
    question: "What does the 15-day trial include?",
    answer:
      "The trial unlocks the product without a credit card. You can run calendars, send client links, and see plan limits before you subscribe. There is no charge during the trial.",
  },
  {
    question: "When is a credit card required?",
    answer:
      "Only when you pick a paid plan after the trial. Starting does not require a card. Billing begins if you subscribe to continue.",
  },
  {
    question: "How do Solo, Starter, Pro, and Studio differ?",
    answer:
      "Plans scale by client roster and agency seats. Posts and reviewers are unlimited on every listed plan. Enterprise is unlimited clients, users, and reviewers — contact us.",
  },
  {
    question: "How do I change or cancel a paid plan?",
    answer:
      "Upgrade, downgrade, and cancel in the billing portal after you subscribe. New plan limits apply when you change. If you cancel, you keep access until the current period ends.",
  },
] as const;

/** Visible pricing FAQ only. No FAQPage JSON-LD — home already publishes that schema. */
export function LandingPricingFaq() {
  return (
    <section className="border-t" style={{ borderColor: "rgba(27,25,23,0.12)" }}>
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr,1.6fr]">
          <div>
            <Eyebrow>Pricing FAQ</Eyebrow>
            <Reveal bare>
              <h2 className="mt-6 text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                Plans, trial, and billing.
              </h2>
            </Reveal>
          </div>
          <div>
            {PRICING_FAQS.map(({ question, answer }, i) => (
              <Reveal key={question} delay={i * 40}>
                <details className="group border-t py-6 last:border-b" style={{ borderColor: "rgba(27,25,23,0.15)" }}>
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-extrabold tracking-tight sm:text-xl [&::-webkit-details-marker]:hidden">
                    {question}
                    <span
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-lg font-medium transition-transform duration-300 group-open:rotate-45"
                      style={{ borderColor: "rgba(27,25,23,0.25)" }}
                      aria-hidden
                    >
                      +
                    </span>
                  </summary>
                  <p className="mt-4 max-w-2xl font-medium leading-relaxed" style={{ color: "rgba(27,25,23,0.6)" }}>
                    {answer}
                  </p>
                </details>
              </Reveal>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
