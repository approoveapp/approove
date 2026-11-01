import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout";
import { getRequestLocale } from "@/lib/request-locale";
import { getAppBaseUrl } from "@/lib/app-url";
import { INDEX_ROBOTS } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return {
    title: "Termos de Uso",
    description: "Termos de Uso da plataforma Approove.",
    robots: INDEX_ROBOTS,
    alternates: { canonical: `${getAppBaseUrl()}/termos` },
  };
}

export default async function TermosPage() {
  const locale = await getRequestLocale();
  return locale === "en" ? <TermsEnglish /> : <TermosPortugues />;
}

function TermosPortugues() {
  return (
    <LegalPageLayout title="Termos de Uso" updatedAt="12 de julho de 2026" locale="pt-BR">
      <p className="text-muted-foreground">
        Estes Termos de Uso regem o acesso e o uso da plataforma Approove,
        disponível em approoveapp.com.
      </p>

      <LegalSection title="1. Aceitação dos termos">
        <p>
          Ao criar uma conta ou utilizar o Approove (&quot;Plataforma&quot;),
          você concorda com estes Termos de Uso e com a nossa{" "}
          <a href="/privacidade">Política de Privacidade</a>. Se você não
          concordar com algum destes termos, não utilize a Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="2. Descrição do serviço">
        <p>
          O Approove é uma plataforma de aprovação de conteúdo para redes
          sociais, que permite a agências e times de marketing organizar
          calendários editoriais, colaborar com clientes e obter aprovações
          de publicações por meio de links de compartilhamento.
        </p>
      </LegalSection>

      <LegalSection title="3. Contas e responsabilidade pelo acesso">
        <ul>
          <li>Você é responsável por manter a confidencialidade da sua senha.</li>
          <li>
            Você é responsável por todas as atividades realizadas na sua
            conta e nas contas dos membros do seu time que você convidar.
          </li>
          <li>
            Links de compartilhamento e convites de revisores dão acesso a
            conteúdo do seu cliente sem exigir criação de conta - cabe a você
            controlar a quem esses links são enviados.
          </li>
          <li>
            Notifique-nos imediatamente em caso de uso não autorizado da sua
            conta.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Planos, cobrança e cancelamento">
        <ul>
          <li>
            O Approove oferece um plano gratuito com limites de uso e planos
            pagos com limites maiores, cobrados por assinatura recorrente
            através do Stripe.
          </li>
          <li>
            Os valores, limites e recursos de cada plano estão descritos na
            página de preços da Plataforma e podem ser alterados mediante
            aviso prévio.
          </li>
          <li>
            Você pode cancelar sua assinatura a qualquer momento pelo portal
            de cobrança; o acesso aos recursos do plano pago permanece até o
            fim do período já pago.
          </li>
          <li>
            Não há reembolso de valores já pagos, exceto quando exigido por
            lei ou a nosso critério.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Conteúdo enviado por você">
        <p>
          Você mantém todos os direitos sobre as artes, textos e demais
          materiais que enviar à Plataforma (&quot;Conteúdo&quot;). Ao enviar
          Conteúdo, você nos concede uma licença limitada, não exclusiva,
          para armazenar, processar e exibir esse Conteúdo exclusivamente
          para operar o serviço - por exemplo, exibi-lo aos revisores do
          cliente através de um link de aprovação.
        </p>
        <p>
          Você declara ter os direitos necessários sobre o Conteúdo enviado e
          é o único responsável por ele.
        </p>
      </LegalSection>

      <LegalSection title="6. Uso aceitável">
        <p>Ao usar a Plataforma, você concorda em não:</p>
        <ul>
          <li>
            Enviar conteúdo ilegal, difamatório, ou que viole direitos de
            terceiros;
          </li>
          <li>Tentar obter acesso não autorizado a contas ou dados de outros usuários;</li>
          <li>
            Utilizar a Plataforma para distribuir malware ou realizar
            ataques a sistemas;
          </li>
          <li>
            Utilizar links de compartilhamento fora do contexto de aprovação
            de conteúdo para o qual foram gerados.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Suspensão e encerramento">
        <p>
          Podemos suspender ou encerrar o acesso à sua conta em caso de
          violação destes Termos, uso fraudulento ou inadimplência. Você pode
          encerrar sua conta a qualquer momento entrando em contato conosco.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitação de responsabilidade">
        <p>
          A Plataforma é fornecida &quot;como está&quot;. Na máxima extensão
          permitida por lei, não nos responsabilizamos por danos indiretos,
          lucros cessantes ou perda de dados decorrentes do uso ou da
          impossibilidade de uso da Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="9. Alterações a estes termos">
        <p>
          Podemos atualizar estes Termos periodicamente. Alterações
          relevantes serão comunicadas por e-mail ou por aviso na Plataforma.
          O uso continuado após a alteração constitui aceitação dos novos
          termos.
        </p>
      </LegalSection>

      <LegalSection title="10. Lei aplicável">
        <p>
          Estes Termos são regidos pelas leis da República Federativa do
          Brasil. Fica eleito o foro da comarca da sede da empresa para
          dirimir eventuais controvérsias.
        </p>
      </LegalSection>

      <LegalSection title="11. Contato">
        <p>
          Dúvidas sobre estes Termos podem ser enviadas para{" "}
          <a href="mailto:contato@approove.app">contato@approove.app</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

// NOTE: English translation of the Portuguese Terms above, pending legal review.
// The Portuguese version is the reference text; keep both in sync when either changes.
function TermsEnglish() {
  return (
    <LegalPageLayout title="Terms of Use" updatedAt="July 12, 2026" locale="en">
      <p className="text-muted-foreground">
        This document is a standard Terms of Use template, provided as a
        starting point. We recommend review by a lawyer before publishing it
        in production, to adapt it to the company&apos;s legal name, CNPJ
        (Brazilian company registration number) and commercial particulars.
      </p>

      <LegalSection title="1. Acceptance of the terms">
        <p>
          By creating an account or using Approove (&quot;Platform&quot;), you
          agree to these Terms of Use and to our{" "}
          <a href="/privacidade">Privacy Policy</a>. If you do not agree with
          any of these terms, do not use the Platform.
        </p>
      </LegalSection>

      <LegalSection title="2. Description of the service">
        <p>
          Approove is a social media content approval platform that allows
          agencies and marketing teams to organize editorial calendars,
          collaborate with clients and obtain approval of posts through share
          links.
        </p>
      </LegalSection>

      <LegalSection title="3. Accounts and responsibility for access">
        <ul>
          <li>You are responsible for keeping your password confidential.</li>
          <li>
            You are responsible for all activities carried out in your account
            and in the accounts of the team members you invite.
          </li>
          <li>
            Share links and reviewer invitations give access to your
            client&apos;s content without requiring an account to be created -
            it is up to you to control who these links are sent to.
          </li>
          <li>
            Notify us immediately in the event of unauthorized use of your
            account.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Plans, billing and cancellation">
        <ul>
          <li>
            Approove offers a free plan with usage limits and paid plans with
            higher limits, charged as a recurring subscription through Stripe.
          </li>
          <li>
            The prices, limits and features of each plan are described on the
            Platform&apos;s pricing page and may be changed upon prior notice.
          </li>
          <li>
            You may cancel your subscription at any time through the billing
            portal; access to the paid plan&apos;s features remains until the
            end of the period already paid for.
          </li>
          <li>
            Amounts already paid are not refunded, except when required by law
            or at our discretion.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Content you submit">
        <p>
          You retain all rights to the creatives, texts and other materials you
          submit to the Platform (&quot;Content&quot;). By submitting Content,
          you grant us a limited, non-exclusive license to store, process and
          display that Content solely to operate the service - for example,
          displaying it to the client&apos;s reviewers through an approval
          link.
        </p>
        <p>
          You represent that you hold the necessary rights to the Content you
          submit and are solely responsible for it.
        </p>
      </LegalSection>

      <LegalSection title="6. Acceptable use">
        <p>When using the Platform, you agree not to:</p>
        <ul>
          <li>
            Submit content that is illegal, defamatory, or that infringes the
            rights of third parties;
          </li>
          <li>Attempt to gain unauthorized access to other users&apos; accounts or data;</li>
          <li>
            Use the Platform to distribute malware or to carry out attacks on
            systems;
          </li>
          <li>
            Use share links outside the content approval context for which they
            were generated.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="7. Suspension and termination">
        <p>
          We may suspend or terminate access to your account in the event of a
          breach of these Terms, fraudulent use or non-payment. You may close
          your account at any time by contacting us.
        </p>
      </LegalSection>

      <LegalSection title="8. Limitation of liability">
        <p>
          The Platform is provided &quot;as is&quot;. To the maximum extent
          permitted by law, we are not liable for indirect damages, lost
          profits or loss of data arising from the use of, or inability to use,
          the Platform.
        </p>
      </LegalSection>

      <LegalSection title="9. Changes to these terms">
        <p>
          We may update these Terms from time to time. Material changes will be
          communicated by email or by a notice on the Platform. Continued use
          after a change constitutes acceptance of the new terms.
        </p>
      </LegalSection>

      <LegalSection title="10. Governing law">
        <p>
          These Terms are governed by the laws of the Federative Republic of
          Brazil. The courts of the judicial district (comarca) where the
          company is headquartered are chosen to settle any disputes.
        </p>
      </LegalSection>

      <LegalSection title="11. Contact">
        <p>
          Questions about these Terms may be sent to{" "}
          <a href="mailto:contato@approove.app">contato@approove.app</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
