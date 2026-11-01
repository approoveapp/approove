import { ScrollFill } from "@/components/landing/scroll-fill";
import { localizedText, type AppLocale } from "@/lib/locale";
import { blue, coral, cream, ink } from "@/components/landing/tokens";

export function LandingMarquee({ locale, aiImport }: { locale: AppLocale; aiImport: boolean }) {
  const allItems =
    locale === "pt-BR"
      ? ["Importação com IA", "Calendário editorial", "Revisão interna", "Link do cliente", "Pins na arte", "Versões", "Aprovação", "Atividade", "Papéis"]
      : ["AI import", "Editorial calendar", "Internal review", "Client link", "Creative pins", "Versions", "Approval", "Activity", "Roles"];
  const items = aiImport ? allItems : allItems.slice(1);

  const strip = (ariaHidden: boolean) => (
    <div aria-hidden={ariaHidden} className="flex shrink-0 items-center">
      {items.map((item) => (
        <span
          key={item}
          className="flex items-center whitespace-nowrap text-2xl font-extrabold uppercase tracking-tight sm:text-3xl"
          style={{ color: cream }}
        >
          <span className="px-6">{item}</span>
          <span style={{ color: blue }}>✦</span>
        </span>
      ))}
    </div>
  );

  return (
    <div className="landing-marquee-wrap overflow-hidden border-y py-5" style={{ backgroundColor: ink, borderColor: ink }}>
      <div className="landing-marquee flex w-max">
        {strip(false)}
        {strip(true)}
      </div>
    </div>
  );
}

export function LandingProblem({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const fragments = locale === "pt-BR"
    ? ["WhatsApp", "E-mail", "Drive", "PDF", "Prints", "Áudios", "Qual versão foi aprovada?"]
    : ["Email", "Slack", "WhatsApp", "Drive", "PDF", "Screenshots", "Voice notes", "Which version was approved?"];

  return (
    <section style={{ backgroundColor: ink, color: cream }}>
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <p className="text-[11px] font-bold uppercase tracking-[0.25em]" style={{ color: "rgba(244,233,225,0.45)" }}>
          {tr("O problema", "The problem")}
        </p>
        <ScrollFill
          text={tr("O aprovadinho ✔ perdido no chat não é processo. É risco.", "An “approved” ✔ lost in chat is not a process. It is a risk.")}
          accents={locale === "pt-BR" ? { É: coral, "risco.": coral } : { "risk.": coral }}
          className="mt-6 max-w-4xl text-[clamp(2rem,5vw,4rem)] font-extrabold leading-[1.02] tracking-[-0.03em]"
        />
        <p className="mt-6 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(244,233,225,0.6)" }}>
          {tr(
            "Aprovação de conteúdo espalhada entre mensagens, pastas e prints. Ninguém consegue apontar, depois, o que valeu.",
            "Content approval scattered across messages, folders, and screenshots. Later, nobody can point to what actually counted."
          )}
        </p>
        <div className="mt-12 flex flex-wrap gap-2">
          {fragments.map((item) => (
            <span
              key={item}
              className="rounded-full border px-4 py-2 text-sm font-semibold"
              style={{ borderColor: "rgba(244,233,225,0.2)", color: "rgba(244,233,225,0.85)" }}
            >
              {item}
            </span>
          ))}
        </div>
        <p className="mt-10 max-w-xl text-xl font-extrabold tracking-tight" style={{ color: cream }}>
          {tr("Aprovação não deveria viver no histórico do chat.", "Approval shouldn’t live in chat history.")}
        </p>
      </div>
    </section>
  );
}
