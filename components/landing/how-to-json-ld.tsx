import { getAppBaseUrl } from "@/lib/app-url";
import { localizedText, type AppLocale } from "@/lib/locale";
import { marketingPath } from "@/lib/marketing-routes";

export function HowToJsonLd({ locale }: { locale: AppLocale }) {
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const base = getAppBaseUrl();
  const url = `${base}${marketingPath("how", locale)}`;

  const graph = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    name: tr("Como funciona a aprovação de conteúdo no Approove", "How content approval works in Approove"),
    description: tr(
      "A agência organiza o calendário, libera só o que está pronto e o cliente revisa pelo link, com registro de quem aprovou.",
      "The agency organizes the calendar, releases only what is ready, and the client reviews via link, with a record of who approved."
    ),
    url,
    step: [
      {
        "@type": "HowToStep",
        position: 1,
        name: tr("Organizar o calendário", "Organize the calendar"),
        text: tr(
          "A agência monta os posts por cliente, com arte, legenda e responsáveis das etapas internas.",
          "The agency builds posts per client, with creative, caption, and owners for internal stages."
        ),
      },
      {
        "@type": "HowToStep",
        position: 2,
        name: tr("Liberar só o que está pronto", "Release only what is ready"),
        text: tr(
          "O cliente não vê copy, design ou revisão interna. Só entra no calendário compartilhado o que está pronto para revisão.",
          "The client does not see copy, design, or internal review. Only work ready for review appears on the shared calendar."
        ),
      },
      {
        "@type": "HowToStep",
        position: 3,
        name: tr("Enviar o link", "Send the link"),
        text: tr(
          "O cliente abre no navegador do celular ou do computador. Não precisa criar conta no fluxo por link.",
          "The client opens it in a phone or desktop browser. No account is required on the shared-link flow."
        ),
      },
      {
        "@type": "HowToStep",
        position: 4,
        name: tr("Revisar, comentar e aprovar", "Review, comment, and approve"),
        text: tr(
          "Pins na arte, comentários na legenda e papéis de visualizador, revisor ou aprovador.",
          "Pins on the creative, comments on the caption, and viewer, reviewer, or approver roles."
        ),
      },
      {
        "@type": "HowToStep",
        position: 5,
        name: tr("Registrar a decisão", "Record the decision"),
        text: tr(
          "O Approove guarda quem aprovou, quando e qual versão da arte e da legenda estava vigente. Se o conteúdo muda, a aprovação deixa de valer.",
          "Approove records who approved, when, and which creative and caption version was current. If the content changes, that approval no longer stands."
        ),
      },
    ],
  };

  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(graph) }} />
  );
}
