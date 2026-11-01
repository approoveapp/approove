import { RotatingWord } from "@/components/landing/rotating-word";
import { Reveal } from "@/components/landing/reveal";
import { Parallax } from "@/components/landing/parallax";
import { Eyebrow, PillLink, TrialNote } from "@/components/landing/ui";
import { ApprovedBadge, CalendarStrip, CreativeCanvas, ProductChrome } from "@/components/landing/product-frames";
import { blue, cream, ink } from "@/components/landing/tokens";
import { localizedText, type AppLocale } from "@/lib/locale";
import { foundingOfferLabel, type FoundingOffer } from "@/lib/founding-offer";
import { marketingPath } from "@/lib/marketing-routes";

function HeroHeadline({ locale }: { locale: AppLocale }) {
  const lines = locale === "pt-BR" ? [["Chega", "de", "aprovar"], ["posts", "pelo"]] : [["Stop", "approving"], ["posts", "on"]];
  const accent = locale === "pt-BR" ? ["WhatsApp.", "E-mail.", "Drive."] : ["email.", "Slack.", "WhatsApp.", "Drive."];
  let wordIndex = 0;

  return (
    <h1 className="max-w-6xl text-[clamp(3rem,10vw,8.5rem)] font-extrabold leading-[0.92] tracking-[-0.045em]">
      {lines.map((words, lineIdx) => (
        <span key={lineIdx} className="block">
          {words.map((word) => {
            const delay = 750 + wordIndex++ * 70;
            return (
              <span key={word} className="hero-mask mr-[0.22em] last:mr-0">
                <span className="hero-word" style={{ animationDelay: `${delay}ms` }}>
                  {word}
                </span>
              </span>
            );
          })}
        </span>
      ))}
      <span className="block">
        <span className="hero-mask">
          <span className="hero-word" style={{ animationDelay: `${750 + wordIndex * 70}ms`, color: blue }}>
            <RotatingWord words={accent} />
          </span>
        </span>
      </span>
    </h1>
  );
}

function HeroMock({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  return (
    <ProductChrome>
      <div className="grid gap-6 p-6 sm:grid-cols-[1.5fr,1fr] sm:p-8">
        <CreativeCanvas locale={locale} versionLabel={tr("Versão vigente", "Current version")} pinComment={tr("Aumentar o logo aqui.", "Make the logo larger here.")} />
        <div className="flex flex-col gap-3">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(27,25,23,0.4)" }}>
            {tr("Calendário → Arte → Comentário → Aprovação", "Calendar → Creative → Comment → Approval")}
          </p>
          <ApprovedBadge locale={locale} />
          <div className="rounded-2xl p-3.5 text-[13px] leading-snug" style={{ backgroundColor: "rgba(27,25,23,0.05)" }}>
            <p className="mb-1 font-bold">{tr("João Silva", "Emma Clarke")}</p>
            <p style={{ color: "rgba(27,25,23,0.6)" }}>{tr("30 set · 14:32 · versão 3", "30 Sep · 14:32 · version 3")}</p>
          </div>
          <div className="mt-auto pt-2">
            <CalendarStrip />
          </div>
        </div>
      </div>
    </ProductChrome>
  );
}

export function FoundingOfferNote({ locale, offer, light = false }: { locale: AppLocale; offer: FoundingOffer; light?: boolean }) {
  const { headline, spots } = foundingOfferLabel(offer, locale);

  return (
    <p className="mt-3 inline-flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-bold">
      <span className="rounded-full px-3 py-1" style={{ backgroundColor: light ? cream : ink, color: light ? ink : cream }}>
        {headline}
      </span>
      {spots && <span style={{ color: light ? "rgba(244,233,225,0.7)" : "rgba(27,25,23,0.6)" }}>{spots}</span>}
    </p>
  );
}

export function LandingHero({ locale, foundingOffer }: { locale: AppLocale; foundingOffer: FoundingOffer | null }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
      <div className="fade-up" style={{ "--d": "550ms" } as React.CSSProperties}>
        <Eyebrow>{tr("Aprovação de conteúdo para social media e agências", "Client approval for social media managers and agencies")}</Eyebrow>
      </div>
      <div className="mt-6">
        <HeroHeadline locale={locale} />
      </div>
      <div className="mt-10 flex flex-col justify-between gap-8 md:flex-row md:items-end">
        <p
          className="fade-up max-w-lg text-lg font-medium leading-snug"
          style={{ "--d": "1350ms", color: "rgba(27,25,23,0.65)" } as React.CSSProperties}
        >
          {tr(
            "Envie o conteúdo para o cliente aprovar por um link e saiba exatamente qual versão ele aprovou. Mudou a arte ou a legenda? A aprovação volta para o cliente.",
            "Send content to your client with one link and know exactly which version they approved. Change the creative or caption, and the approval resets."
          )}
        </p>
        <div className="fade-up flex flex-wrap items-center gap-3" style={{ "--d": "1500ms" } as React.CSSProperties}>
          <PillLink href="/signup">{tr("Testar grátis", "Start free trial")}</PillLink>
          <PillLink href={marketingPath("how", locale)} variant="outline">
            {tr("Ver como funciona", "See how it works")}
          </PillLink>
        </div>
      </div>
      <div className="fade-up mt-4" style={{ "--d": "1650ms" } as React.CSSProperties}>
        <TrialNote>{tr("15 dias grátis · sem cartão", "15 days free · no credit card")}</TrialNote>
        {foundingOffer && <FoundingOfferNote locale={locale} offer={foundingOffer} />}
      </div>
      <Reveal className="mt-16">
        <Parallax speed={0.06}>
          <HeroMock locale={locale} />
        </Parallax>
      </Reveal>
    </section>
  );
}
