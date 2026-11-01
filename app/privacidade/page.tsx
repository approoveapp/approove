import type { Metadata } from "next";
import { LegalPageLayout, LegalSection } from "@/components/legal-page-layout";
import { getRequestLocale } from "@/lib/request-locale";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  if (locale === "en") {
    return {
      title: "Privacy Policy - Approove",
      description: "Privacy Policy for the Approove platform.",
    };
  }
  return {
    title: "Política de Privacidade - Approove",
    description: "Política de Privacidade da plataforma Approove.",
  };
}

export default async function PrivacidadePage() {
  const locale = await getRequestLocale();
  return locale === "en" ? <PrivacyEnglish /> : <PrivacidadePortugues />;
}

function PrivacidadePortugues() {
  return (
    <LegalPageLayout title="Política de Privacidade" updatedAt="22 de outubro de 2026" locale="pt-BR">
      <p className="text-muted-foreground">
        Este documento é um modelo padrão de Política de Privacidade,
        elaborado com base na Lei Geral de Proteção de Dados (LGPD, Lei nº
        13.709/2018) e disponibilizado como ponto de partida. Recomendamos
        revisão por um advogado ou DPO antes da publicação em produção.
      </p>

      <LegalSection title="1. Quem trata seus dados">
        <p>
          O Approove (&quot;nós&quot;) é o controlador dos dados pessoais
          tratados por meio desta Plataforma, nos termos da LGPD.
        </p>
      </LegalSection>

      <LegalSection title="2. Dados que coletamos">
        <p>Coletamos os seguintes tipos de dados:</p>
        <ul>
          <li>
            <strong>Dados de conta:</strong> nome, e-mail e senha (armazenada
            com hash, nunca em texto plano) de quem se cadastra na
            Plataforma.
          </li>
          <li>
            <strong>Dados da organização:</strong> nome da agência ou empresa
            e informações de cobrança processadas pelo Stripe.
          </li>
          <li>
            <strong>Dados de clientes cadastrados por você:</strong> nome,
            CNPJ, endereço e redes sociais que você cadastrar sobre seus
            próprios clientes.
          </li>
          <li>
            <strong>Conteúdo enviado:</strong> imagens, vídeos, textos de
            publicação, comentários e anotações feitas na Plataforma.
          </li>
          <li>
            <strong>Dados de revisores convidados:</strong> nome e e-mail de
            pessoas convidadas para revisar ou aprovar conteúdo, mesmo sem
            criarem conta.
          </li>
          <li>
            <strong>Dados de uso:</strong> registros técnicos de acesso
            (como data e hora de aprovação de uma publicação), necessários
            para o funcionamento e auditoria da Plataforma.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. Para que usamos seus dados">
        <ul>
          <li>Fornecer e operar as funcionalidades da Plataforma;</li>
          <li>Processar pagamentos e gerenciar assinaturas;</li>
          <li>
            Enviar e-mails transacionais, como convites de revisores e
            redefinição de senha;
          </li>
          <li>Prevenir fraudes e garantir a segurança da Plataforma;</li>
          <li>Cumprir obrigações legais e regulatórias.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Bases legais (LGPD, art. 7º)">
        <p>Tratamos seus dados com base em:</p>
        <ul>
          <li>
            <strong>Execução de contrato:</strong> para fornecer o serviço
            que você contratou;
          </li>
          <li>
            <strong>Legítimo interesse:</strong> para segurança, prevenção a
            fraudes e melhoria do serviço;
          </li>
          <li>
            <strong>Cumprimento de obrigação legal:</strong> para fins fiscais
            e contábeis relacionados à cobrança.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Com quem compartilhamos dados">
        <p>
          Utilizamos os seguintes prestadores de serviço (operadores, nos
          termos da LGPD) para operar a Plataforma:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> - processamento de pagamentos e gestão de
            assinaturas;
          </li>
          <li>
            <strong>Resend</strong> - envio de e-mails transacionais;
          </li>
          <li>
            <strong>Vercel Blob</strong> - armazenamento de imagens e vídeos
            enviados à Plataforma;
          </li>
          <li>
            <strong>Turso / Neon</strong> - hospedagem do banco de dados da
            aplicação;
          </li>
          <li>
            <strong>Anthropic</strong> - processamento por IA dos arquivos que
            você envia na importação de calendário. Os documentos são usados só
            para gerar a proposta de publicações e não ficam guardados na
            Plataforma; imagens e vídeos ficam armazenados como materiais das
            publicações, como em qualquer upload;
          </li>
          <li>
            <strong>Vercel</strong> - hospedagem da aplicação.
          </li>
        </ul>
        <p>
          Não vendemos dados pessoais a terceiros. Dados de clientes e
          revisores só são compartilhados com quem você mesmo convidar por
          meio da Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          Utilizamos cookies essenciais para manter sua sessão autenticada
          (via NextAuth), para lembrar sua preferência de tema (claro/escuro)
          e, se você escolher um idioma, para lembrar essa escolha. Não utilizamos cookies de rastreamento publicitário.
        </p>
      </LegalSection>

      <LegalSection title="7. Retenção de dados">
        <p>
          Mantemos seus dados enquanto sua conta estiver ativa. Ao solicitar
          o encerramento da conta, os dados pessoais são excluídos ou
          anonimizados em prazo razoável, exceto quando devamos retê-los por
          obrigação legal (por exemplo, dados fiscais de cobrança).
        </p>
      </LegalSection>

      <LegalSection title="8. Seus direitos (LGPD, art. 18)">
        <p>Você pode, a qualquer momento, solicitar:</p>
        <ul>
          <li>Confirmação da existência de tratamento de seus dados;</li>
          <li>Acesso aos seus dados;</li>
          <li>Correção de dados incompletos, inexatos ou desatualizados;</li>
          <li>
            Anonimização, bloqueio ou eliminação de dados desnecessários ou
            tratados em desconformidade com a lei;
          </li>
          <li>Portabilidade dos dados a outro fornecedor de serviço;</li>
          <li>Eliminação dos dados tratados com base no seu consentimento;</li>
          <li>Informação sobre com quem compartilhamos seus dados;</li>
          <li>Revogação do consentimento, quando aplicável.</li>
        </ul>
        <p>
          Para exercer esses direitos, entre em contato pelo e-mail abaixo.
        </p>
      </LegalSection>

      <LegalSection title="9. Segurança">
        <p>
          Adotamos medidas técnicas e organizacionais para proteger seus
          dados, incluindo senhas armazenadas com hash (bcrypt), conexões
          criptografadas (HTTPS) e controle de acesso por organização.
          Nenhum sistema é 100% seguro; caso identifique uma vulnerabilidade,
          entre em contato conosco.
        </p>
      </LegalSection>

      <LegalSection title="10. Menores de idade">
        <p>
          A Plataforma não é direcionada a menores de 18 anos e não coleta
          intencionalmente dados de crianças ou adolescentes.
        </p>
      </LegalSection>

      <LegalSection title="11. Alterações a esta política">
        <p>
          Podemos atualizar esta Política periodicamente. Alterações
          relevantes serão comunicadas por e-mail ou por aviso na Plataforma.
        </p>
      </LegalSection>

      <LegalSection title="12. Contato do controlador / encarregado (DPO)">
        <p>
          Dúvidas, solicitações ou reclamações sobre o tratamento de dados
          pessoais podem ser enviadas para{" "}
          <a href="mailto:contato@approove.app">contato@approove.app</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}

// NOTE: English translation of the Portuguese Privacy Policy above, pending legal
// review. The Portuguese version is the reference text; keep both in sync when
// either changes. References to Brazilian law (LGPD) are kept on purpose.
function PrivacyEnglish() {
  return (
    <LegalPageLayout title="Privacy Policy" updatedAt="October 22, 2026" locale="en">
      <p className="text-muted-foreground">
        This document is a standard Privacy Policy template, prepared based on
        Brazil&apos;s General Data Protection Law (Lei Geral de Proteção de
        Dados - LGPD, Law No. 13,709/2018) and provided as a starting point. We
        recommend review by a lawyer or DPO before publishing it in production.
      </p>

      <LegalSection title="1. Who processes your data">
        <p>
          Approove (&quot;we&quot;) is the controller of the personal data
          processed through this Platform, within the meaning of the LGPD.
        </p>
      </LegalSection>

      <LegalSection title="2. Data we collect">
        <p>We collect the following types of data:</p>
        <ul>
          <li>
            <strong>Account data:</strong> name, email and password (stored as
            a hash, never in plain text) of those who sign up for the Platform.
          </li>
          <li>
            <strong>Organization data:</strong> name of the agency or company
            and billing information processed by Stripe.
          </li>
          <li>
            <strong>Data about clients you register:</strong> name, CNPJ
            (Brazilian company registration number), address and social media
            profiles that you register about your own clients.
          </li>
          <li>
            <strong>Submitted content:</strong> images, videos, post texts,
            comments and annotations made on the Platform.
          </li>
          <li>
            <strong>Invited reviewer data:</strong> name and email of people
            invited to review or approve content, even if they do not create an
            account.
          </li>
          <li>
            <strong>Usage data:</strong> technical access logs (such as the date
            and time a post was approved), necessary for the operation and
            auditing of the Platform.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="3. What we use your data for">
        <ul>
          <li>Providing and operating the Platform&apos;s features;</li>
          <li>Processing payments and managing subscriptions;</li>
          <li>
            Sending transactional emails, such as reviewer invitations and
            password resets;
          </li>
          <li>Preventing fraud and ensuring the security of the Platform;</li>
          <li>Complying with legal and regulatory obligations.</li>
        </ul>
      </LegalSection>

      <LegalSection title="4. Legal bases (LGPD, art. 7)">
        <p>We process your data on the following bases:</p>
        <ul>
          <li>
            <strong>Performance of a contract:</strong> to provide the service
            you signed up for;
          </li>
          <li>
            <strong>Legitimate interest:</strong> for security, fraud
            prevention and improvement of the service;
          </li>
          <li>
            <strong>Compliance with a legal obligation:</strong> for tax and
            accounting purposes related to billing.
          </li>
        </ul>
      </LegalSection>

      <LegalSection title="5. Who we share data with">
        <p>
          We use the following service providers (processors, or
          &quot;operadores&quot;, within the meaning of the LGPD) to operate
          the Platform:
        </p>
        <ul>
          <li>
            <strong>Stripe</strong> - payment processing and subscription
            management;
          </li>
          <li>
            <strong>Resend</strong> - sending of transactional emails;
          </li>
          <li>
            <strong>Vercel Blob</strong> - storage of images and videos
            uploaded to the Platform;
          </li>
          <li>
            <strong>Turso / Neon</strong> - hosting of the application&apos;s
            database;
          </li>
          <li>
            <strong>Anthropic</strong> - AI processing of the files you upload
            when importing a calendar. The documents are used only to generate
            the proposed posts and are not kept on the Platform; images and
            videos are stored as post creatives, as with any upload;
          </li>
          <li>
            <strong>Vercel</strong> - hosting of the application.
          </li>
        </ul>
        <p>
          We do not sell personal data to third parties. Client and reviewer
          data are only shared with the people you yourself invite through the
          Platform.
        </p>
      </LegalSection>

      <LegalSection title="6. Cookies">
        <p>
          We use essential cookies to keep your session authenticated (via
          NextAuth), to remember your theme preference (light/dark) and, if you
          pick a language, to remember that choice. We do not use advertising tracking cookies.
        </p>
      </LegalSection>

      <LegalSection title="7. Data retention">
        <p>
          We keep your data for as long as your account is active. When you
          request that your account be closed, personal data is deleted or
          anonymized within a reasonable period, except where we must retain it
          due to a legal obligation (for example, billing tax data).
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights (LGPD, art. 18)">
        <p>You may, at any time, request:</p>
        <ul>
          <li>Confirmation that your data is being processed;</li>
          <li>Access to your data;</li>
          <li>Correction of incomplete, inaccurate or outdated data;</li>
          <li>
            Anonymization, blocking or deletion of unnecessary data or data
            processed in breach of the law;
          </li>
          <li>Portability of your data to another service provider;</li>
          <li>Deletion of data processed on the basis of your consent;</li>
          <li>Information about who we share your data with;</li>
          <li>Withdrawal of consent, where applicable.</li>
        </ul>
        <p>
          To exercise these rights, contact us at the email address below.
        </p>
      </LegalSection>

      <LegalSection title="9. Security">
        <p>
          We adopt technical and organizational measures to protect your data,
          including passwords stored as hashes (bcrypt), encrypted connections
          (HTTPS) and per-organization access control. No system is 100%
          secure; if you identify a vulnerability, please contact us.
        </p>
      </LegalSection>

      <LegalSection title="10. Minors">
        <p>
          The Platform is not directed at persons under 18 years of age and does
          not knowingly collect data from children or adolescents.
        </p>
      </LegalSection>

      <LegalSection title="11. Changes to this policy">
        <p>
          We may update this Policy from time to time. Material changes will be
          communicated by email or by a notice on the Platform.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact for the controller / data protection officer (DPO)">
        <p>
          Questions, requests or complaints about the processing of personal
          data may be sent to{" "}
          <a href="mailto:contato@approove.app">contato@approove.app</a>.
        </p>
      </LegalSection>
    </LegalPageLayout>
  );
}
