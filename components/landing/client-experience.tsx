import { Reveal } from "@/components/landing/reveal";
import { MaskedWords } from "@/components/landing/masked-words";
import { Eyebrow, SectionHeading } from "@/components/landing/ui";
import { CreativeCanvas, PhoneFrame } from "@/components/landing/product-frames";
import { amber, blue, green, paper } from "@/components/landing/tokens";
import { localizedText, type AppLocale } from "@/lib/locale";

export function LandingClientExperience({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const steps = locale === "pt-BR"
    ? [
        "Recebe um link",
        "Abre no celular ou no desktop",
        "Vê só o que está pronto para revisão",
        "Comenta e marca pontos na imagem",
        "Pede ajustes ou aprova",
      ]
    : [
        "Gets a link",
        "Opens it on phone or desktop",
        "Sees only content ready for review",
        "Comments and pins points on the image",
        "Requests changes or approves",
      ];

  return (
    <section id="como-funciona" className="scroll-mt-16" style={{ backgroundColor: "#EFE2D6" }}>
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Eyebrow>{tr("Experiência do cliente", "Client experience")}</Eyebrow>
        <Reveal bare>
          <SectionHeading>
            <MaskedWords text={tr("Seu cliente não precisa aprender mais uma ferramenta.", "Your client does not need to learn another tool.")} />
          </SectionHeading>
        </Reveal>
        <p className="mt-6 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(27,25,23,0.6)" }}>
          {tr(
            "O caminho mais comum continua o mesmo: WhatsApp → link → revisão no navegador. Sem app para instalar. Sem conta obrigatória no link compartilhado.",
            "Send one link wherever you already talk to them: email, Slack, or WhatsApp. They review in the browser. Nothing to install, no account on the shared link."
          )}
        </p>

        <div className="mt-14 grid items-center gap-10 lg:grid-cols-[0.9fr,1.1fr]">
          <Reveal>
            <PhoneFrame>
              <div className="px-3 pb-4 pt-3" style={{ backgroundColor: paper }}>
                <p className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em]" style={{ color: "rgba(27,25,23,0.4)" }}>
                  {tr("Revisão", "Review")}
                </p>
                <CreativeCanvas locale={locale} versionLabel={tr("Vigente", "Current")} pinComment={tr("Aumentar o logo aqui.", "Make the logo larger here.")} />
                <div className="mt-3 flex gap-2">
                  <span className="flex-1 rounded-full py-2 text-center text-[10px] font-bold text-white" style={{ backgroundColor: amber }}>
                    {tr("Pedir ajustes", "Request changes")}
                  </span>
                  <span className="flex-1 rounded-full py-2 text-center text-[10px] font-bold text-white" style={{ backgroundColor: green }}>
                    {tr("Aprovar", "Approve")}
                  </span>
                </div>
              </div>
            </PhoneFrame>
          </Reveal>
          <ol className="space-y-4">
            {steps.map((step, i) => (
              <Reveal key={step} delay={i * 50}>
                <li className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-extrabold text-white" style={{ backgroundColor: blue }}>
                    {i + 1}
                  </span>
                  <p className="pt-1 text-lg font-extrabold tracking-tight">{step}</p>
                </li>
              </Reveal>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
