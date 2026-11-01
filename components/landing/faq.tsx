import { Reveal } from "@/components/landing/reveal";
import { Eyebrow } from "@/components/landing/ui";
import { localizedText, type AppLocale } from "@/lib/locale";

export function getLandingFaqs(locale: AppLocale, aiImport: boolean) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const faqs = [
    {
      question: tr("O Approove agenda ou publica os posts?", "Does Approove schedule or publish posts?"),
      answer: tr(
        "Não. O Approove cuida da aprovação: calendário, revisão do cliente e registro do que foi aprovado. Depois de aprovado, você publica pela ferramenta que já usa (Meta Business Suite, Later, Buffer, mLabs ou outra).",
        "No. Approove handles the approval: the calendar, client review, and a record of what was approved. Once a post is approved, you publish it with the tool you already use (Meta Business Suite, Later, Buffer, or any other)."
      ),
    },
    {
      question: tr("Qual a diferença para Planable, Later ou Sprout Social?", "How is it different from Planable, Later, or Sprout Social?"),
      answer: tr(
        "Essas ferramentas são, em geral, agendadores que oferecem aprovação, muitas vezes em planos mais caros ou cobrando por usuário. O Approove é focado na aprovação: a aprovação fica presa à versão exata da arte e da legenda, o cliente marca pins na arte, e o preço é pelo número de clientes, com revisores ilimitados em todos os planos.",
        "Those tools are mostly schedulers that also offer approvals, often on higher plans or priced per seat. Approove focuses on the approval itself: each approval is tied to the exact version of the creative and caption, clients pin feedback on the creative, and pricing is by number of clients, with unlimited reviewers on every plan."
      ),
    },
    {
      question: tr("Preciso instalar alguma coisa?", "Do I need to install anything?"),
      answer: tr(
        "Não. Agência e cliente usam o navegador. Não há app para baixar.",
        "No. Agency and client use the browser. There is no app to download."
      ),
    },
    {
      question: tr("Meu cliente precisa criar conta?", "Does my client need an account?"),
      answer: tr(
        "Não no fluxo compartilhado por link. O cliente abre o calendário no navegador. Você também pode convidar revisores nomeados, com papéis de visualizador, revisor ou aprovador.",
        "Not on the shared link. The client opens the calendar in the browser. You can also invite named reviewers with viewer, reviewer, or approver roles."
      ),
    },
    {
      question: tr("Funciona no celular?", "Does it work on mobile?"),
      answer: tr(
        "Sim. A revisão abre no navegador do celular. O caminho típico é receber o link e revisar ali.",
        "Yes. Review opens in the phone browser. The typical path is receiving a link and reviewing there."
      ),
    },
    {
      question: tr("Quem pode aprovar?", "Who can approve?"),
      answer: tr(
        "Quem tem o papel de aprovador. Visualizador só vê. Revisor vê, comenta e marca pins. Um link compartilhado legado, sem convite nomeado, é tratado como aprovador.",
        "Anyone with the approver role. Viewers can only look. Reviewers can see, comment, and pin. A legacy shared link without a named invite is treated as approver."
      ),
    },
    {
      question: tr("Consigo revisar versões anteriores?", "Can I review previous versions?"),
      answer: tr(
        "Sim. Versões anteriores continuam consultáveis, com os pins daquela versão. Aprovar só vale para o pacote vigente - a arte e a legenda atuais.",
        "Yes. Earlier versions remain viewable, with that version’s pins. Approval applies only to the current package - the current creative and caption."
      ),
    },
    {
      question: tr("O que acontece se eu alterar um conteúdo aprovado?", "What happens if I change approved content?"),
      answer: tr(
        "A aprovação anterior permanece no histórico. Se a arte ou a legenda mudar, a aprovação deixa de valer e o conteúdo volta a precisar de revisão.",
        "The previous approval stays in the history. If the creative or caption changes, that approval no longer stands and the content needs review again."
      ),
    },
    {
      id: "ai-import",
      question: tr("Consigo trazer o calendário que já tenho?", "Can I bring the calendar I already have?"),
      answer: tr(
        "Sim. Na importação com IA você envia a planilha de pauta, o briefing, os documentos de legenda e as artes (imagens e vídeos). A IA monta as publicações com datas, horários, canais, legendas exatamente como estão e cada arte no post certo. Ela não escreve conteúdo, e nada é criado antes de você conferir.",
        "Yes. With AI import you upload the content plan, the brief, caption documents, and creatives (images and videos). The AI builds the posts with dates, times, channels, captions exactly as written, and each creative on the right post. It does not write content, and nothing is created until you check it."
      ),
    },
    {
      question: tr("Preciso cadastrar cartão?", "Do I need to add a card?"),
      answer: tr(
        "Não para começar. O teste de 15 dias não pede cartão. O cartão só entra quando você escolhe um plano para continuar.",
        "Not to start. The 15-day trial does not ask for a card. A card is only needed when you choose a plan to continue."
      ),
    },
    {
      question: tr("Posso cancelar?", "Can I cancel?"),
      answer: tr(
        "Sim. Você cancela pelo portal de cobrança depois de assinar. Durante o teste grátis, não há cobrança.",
        "Yes. You cancel in the billing portal after you subscribe. During the free trial, there is no charge."
      ),
    },
    {
      question: tr("Quais formatos de conteúdo posso revisar?", "Which content formats can I review?"),
      answer: tr(
        "Imagens (JPEG, PNG, GIF, WebP, SVG), vídeos MP4 e MOV, e carrosséis com vários slides. Pins na arte valem para imagens; legenda e vídeo usam comentários.",
        "Images (JPEG, PNG, GIF, WebP, SVG), MP4 and MOV video, and carousels with multiple slides. Creative pins apply to images; caption and video use comments."
      ),
    },
    {
      question: tr("Posso mudar de plano depois?", "Can I change plans later?"),
      answer: tr(
        "Sim. Upgrade e downgrade pelo portal de cobrança. Os limites do plano passam a valer na mudança.",
        "Yes. Upgrade and downgrade in the billing portal. The new plan limits apply when you change."
      ),
    },
  ];
  return aiImport ? faqs : faqs.filter((faq) => faq.id !== "ai-import");
}

export function LandingFaq({ locale, aiImport }: { locale: AppLocale; aiImport: boolean }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const faqs = getLandingFaqs(locale, aiImport);

  return (
    <section id="faq" className="scroll-mt-16 border-t" style={{ borderColor: "rgba(27,25,23,0.12)" }}>
      <div className="mx-auto max-w-7xl px-5 py-24 sm:px-8">
        <div className="grid gap-12 lg:grid-cols-[1fr,1.6fr]">
          <div>
            <Eyebrow>FAQ</Eyebrow>
            <Reveal bare>
              <h2 className="mt-6 text-[clamp(2rem,4vw,3.2rem)] font-extrabold leading-[1.05] tracking-[-0.03em]">
                {tr("Perguntas frequentes.", "Frequently asked questions.")}
              </h2>
            </Reveal>
          </div>
          <div>
            {faqs.map(({ question, answer }, i) => (
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
