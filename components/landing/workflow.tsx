import { Reveal } from "@/components/landing/reveal";
import { MaskedWords } from "@/components/landing/masked-words";
import { Eyebrow, SectionHeading } from "@/components/landing/ui";
import { Panel } from "@/components/landing/product-frames";
import { amber, blue, green, ink, purple } from "@/components/landing/tokens";
import { localizedText, type AppLocale } from "@/lib/locale";

export function LandingWorkflow({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const stages = locale === "pt-BR"
    ? [
        ["Copy", "Ana"],
        ["Design", "Carlos"],
        ["Revisão interna", "Thiago"],
        ["Pronto para cliente", ""],
        ["Revisão do cliente", ""],
        ["Aprovado", ""],
      ]
    : [
        ["Copy", "Ana"],
        ["Design", "Carlos"],
        ["Internal review", "Thiago"],
        ["Ready for client", ""],
        ["Client review", ""],
        ["Approved", ""],
      ];

  return (
    <section id="equipes" className="scroll-mt-16">
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <Eyebrow>{tr("Para equipes", "For teams")}</Eyebrow>
        <Reveal bare>
          <SectionHeading>
            <MaskedWords text={tr("Da produção interna à aprovação do cliente.", "From internal production to client approval.")} />
          </SectionHeading>
        </Reveal>
        <p className="mt-6 max-w-2xl text-lg font-medium leading-snug" style={{ color: "rgba(27,25,23,0.6)" }}>
          {tr(
            "A equipe organiza o conteúdo, acompanha responsáveis e só libera para o cliente aquilo que está realmente pronto para revisão.",
            "The team organizes the work, tracks who owns the next step, and only releases to the client what is actually ready for review."
          )}
        </p>

        <Reveal className="mt-12">
          <div className="relative overflow-x-auto pb-2">
            <div className="absolute left-3 right-3 top-[1.15rem] h-px origin-left bg-[rgba(27,25,23,0.12)]" aria-hidden />
            <div className="lp-pipeline-fill absolute left-3 right-3 top-[1.15rem] h-px origin-left scale-x-0" style={{ backgroundColor: blue }} aria-hidden />
            <ol className="relative flex min-w-[40rem] gap-4 sm:min-w-0 sm:grid sm:grid-cols-6">
              {stages.map(([label, owner], i) => (
                <li key={label} className="min-w-[7.5rem] flex-1">
                  <span
                    className="mb-3 flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white"
                    style={{ backgroundColor: i < 4 ? ink : i === 5 ? green : amber }}
                  >
                    {i + 1}
                  </span>
                  <p className="text-sm font-extrabold tracking-tight">{label}</p>
                  {owner ? (
                    <p className="mt-1 text-xs font-medium" style={{ color: "rgba(27,25,23,0.5)" }}>
                      {owner}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-4 md:grid-cols-2">
          <Reveal>
            <Panel>
              <p className="text-sm font-extrabold">{tr("Saiba de quem é o próximo passo.", "Know whose turn it is.")}</p>
              <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: "rgba(27,25,23,0.6)" }}>
                {tr(
                  "Etapas de produção, atribuições e handoff ficam na operação da agência. O cliente não precisa ver esse bastidor.",
                  "Production stages, assignments, and handoff stay inside the agency. The client does not need to see that operation."
                )}
              </p>
              <div className="mt-4 space-y-2">
                {[
                  [tr("Copy em produção", "Copy in production"), "Ana", purple],
                  [tr("Aguardando design", "Waiting on design"), "Carlos", blue],
                  [tr("Revisão interna", "Internal review"), "Thiago", amber],
                ].map(([stage, person, color]) => (
                  <div
                    key={stage as string}
                    className="flex items-center justify-between rounded-xl border px-3 py-2 text-xs font-semibold"
                    style={{ borderColor: "rgba(27,25,23,0.1)", backgroundColor: "#FDFAF6" }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color as string }} />
                      {stage}
                    </span>
                    <span style={{ color: "rgba(27,25,23,0.5)" }}>{person}</span>
                  </div>
                ))}
              </div>
            </Panel>
          </Reveal>
          <Reveal delay={80}>
            <Panel>
              <p className="text-sm font-extrabold">{tr("O cliente só vê o que está pronto.", "The client only sees what’s ready.")}</p>
              <p className="mt-2 text-sm font-medium leading-relaxed" style={{ color: "rgba(27,25,23,0.6)" }}>
                {tr(
                  "Posts que ainda não estão em “Pronto para cliente” não entram no calendário compartilhado. Isso é garantido no servidor, não só na tela.",
                  "Posts that are not yet “Ready for client” do not appear on the shared calendar. That boundary is enforced on the server, not only in the UI."
                )}
              </p>
            </Panel>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
