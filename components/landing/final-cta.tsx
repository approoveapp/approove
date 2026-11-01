import Link from "next/link";
import { Reveal } from "@/components/landing/reveal";
import { MaskedWords } from "@/components/landing/masked-words";
import { Parallax } from "@/components/landing/parallax";
import { Eyebrow, PillLink, TrialNote } from "@/components/landing/ui";
import { cream, green, ink } from "@/components/landing/tokens";
import { localizedText, type AppLocale } from "@/lib/locale";
import { LanguageSwitch } from "@/components/language-switch";

export function LandingFinalCta({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  return (
    <section style={{ backgroundColor: ink, color: cream }}>
      <div className="mx-auto max-w-7xl px-5 pb-10 pt-24 sm:px-8">
        <Reveal bare>
          <h2 className="max-w-5xl text-[clamp(2.5rem,7vw,6rem)] font-extrabold leading-[0.95] tracking-[-0.04em]">
            <MaskedWords
              text={tr("Sua próxima aprovação não precisa acontecer no WhatsApp.", "Your next approval doesn’t have to get lost in a chat.")}
              accents={{ "WhatsApp.": green, "chat.": green }}
            />
          </h2>
        </Reveal>
        <Reveal delay={120}>
          <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
            <PillLink href="/signup" light>
              {tr("Testar grátis", "Start free trial")}
            </PillLink>
            <TrialNote light>{tr("15 dias grátis · sem cartão", "15 days free · no credit card")}</TrialNote>
          </div>
        </Reveal>

        <div className="mt-24 border-t pt-10" style={{ borderColor: "rgba(244,233,225,0.15)" }}>
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-xs">
              <Eyebrow light>Approove</Eyebrow>
              <p className="mt-3 text-sm font-medium" style={{ color: "rgba(244,233,225,0.55)" }}>
                {tr("Aprovação de conteúdo para social media e agências.", "Client content approval for social media managers and agencies.")}
              </p>
              <LanguageSwitch locale={locale} className="mt-5 text-sm" />
            </div>
            <nav className="grid grid-cols-2 gap-x-14 gap-y-3 text-sm font-semibold sm:text-right">
              {[
                ["#como-funciona", tr("Como funciona", "How it works")],
                ["#aprovacao", tr("Aprovação", "Approval")],
                ["#funcionalidades", tr("Funcionalidades", "Features")],
                ["#precos", tr("Preços", "Pricing")],
                ["/login", tr("Entrar", "Log in")],
                ["/signup", tr("Criar conta", "Create account")],
                ["/termos", tr("Termos de Uso", "Terms of Use")],
                ["/privacidade", tr("Privacidade", "Privacy")],
              ].map(([href, label]) =>
                href.startsWith("#") ? (
                  <a key={href} href={href} className="opacity-60 transition-opacity hover:opacity-100">
                    {label}
                  </a>
                ) : (
                  <Link key={href} href={href} className="opacity-60 transition-opacity hover:opacity-100">
                    {label}
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>

        <Parallax speed={0.12}>
          <p
            aria-hidden
            className="mt-16 select-none text-center text-[clamp(4rem,17vw,15rem)] font-extrabold leading-[0.8] tracking-[-0.05em]"
            style={{ color: "rgba(244,233,225,0.1)" }}
          >
            approove
          </p>
        </Parallax>
        <p className="mt-8 pb-2 text-center text-xs font-medium" style={{ color: "rgba(244,233,225,0.35)" }}>
          © {new Date().getFullYear()} Approove. {tr("Todos os direitos reservados.", "All rights reserved.")}
        </p>
      </div>
    </section>
  );
}
