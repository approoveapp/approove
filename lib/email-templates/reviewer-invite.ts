import type { ClientInviteRole } from "@/lib/share-access";
import { absoluteUrl } from "@/lib/app-url";
import { localizedText, type AppLocale } from "@/lib/locale";

const ROLE_LABELS: Record<AppLocale, Record<ClientInviteRole, string>> = {
  "pt-BR": {
    viewer: "Visualizador - só visualiza o calendário",
    reviewer: "Revisor - comenta e anota nas artes",
    approver: "Aprovador - comenta, anota e aprova publicações",
  },
  en: {
    viewer: "Viewer - can only view the calendar",
    reviewer: "Reviewer - comments on and annotates creatives",
    approver: "Approver - comments, annotates and approves posts",
  },
};

export interface ReviewerInviteEmailParams {
  reviewerName: string;
  organizationName: string;
  clientNames: string[];
  role: ClientInviteRole;
  calendarVersion: string;
  sharePath: string;
  invitedByName?: string | null;
  locale: AppLocale;
}

export function buildReviewerInviteEmail(params: ReviewerInviteEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { locale } = params;
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const shareUrl = absoluteUrl(params.sharePath);
  const clientsLine =
    params.clientNames.length === 1
      ? params.clientNames[0]
      : params.clientNames.join(", ");
  const roleLabel = ROLE_LABELS[locale][params.role];
  const inviterLine = params.invitedByName
    ? `<p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.5;">
        ${tr(
          `${escapeHtml(params.invitedByName)} da <strong>${escapeHtml(params.organizationName)}</strong> convidou você para revisar conteúdo no Approove.`,
          `${escapeHtml(params.invitedByName)} from <strong>${escapeHtml(params.organizationName)}</strong> invited you to review content on Approove.`,
        )}
      </p>`
    : `<p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.5;">
        ${tr(
          `<strong>${escapeHtml(params.organizationName)}</strong> convidou você para revisar conteúdo no Approove.`,
          `<strong>${escapeHtml(params.organizationName)}</strong> invited you to review content on Approove.`,
        )}
      </p>`;

  const subject = tr(
    `${params.organizationName} - convite para revisar ${clientsLine}`,
    `${params.organizationName} - invitation to review ${clientsLine}`,
  );

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;">Approove</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b;">${tr("Olá", "Hi")}, ${escapeHtml(params.reviewerName)}</h1>
    ${inviterLine}
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#71717a;vertical-align:top;">${tr("Cliente(s)", "Client(s)")}</td>
        <td style="padding:8px 0;color:#18181b;font-weight:500;">${escapeHtml(clientsLine)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a;vertical-align:top;">${tr("Calendário", "Calendar")}</td>
        <td style="padding:8px 0;color:#18181b;">${escapeHtml(params.calendarVersion)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a;vertical-align:top;">${tr("Seu papel", "Your role")}</td>
        <td style="padding:8px 0;color:#18181b;">${escapeHtml(roleLabel)}</td>
      </tr>
    </table>
    <a href="${shareUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">
      ${tr("Abrir calendário de aprovação", "Open approval calendar")}
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;word-break:break-all;">
      ${tr("Ou copie este link:", "Or copy this link:")} <a href="${shareUrl}" style="color:#52525b;">${shareUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      ${tr(
        "Não é necessário criar conta - o link é pessoal. Se você não esperava este convite, ignore este e-mail.",
        "No account needed - this link is personal to you. If you weren't expecting this invitation, you can ignore this email.",
      )}
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${tr("Olá", "Hi")}, ${params.reviewerName}`,
    "",
    params.invitedByName
      ? tr(
          `${params.invitedByName} da ${params.organizationName} convidou você para revisar conteúdo no Approove.`,
          `${params.invitedByName} from ${params.organizationName} invited you to review content on Approove.`,
        )
      : tr(
          `${params.organizationName} convidou você para revisar conteúdo no Approove.`,
          `${params.organizationName} invited you to review content on Approove.`,
        ),
    "",
    `${tr("Cliente(s)", "Client(s)")}: ${clientsLine}`,
    `${tr("Calendário", "Calendar")}: ${params.calendarVersion}`,
    `${tr("Papel", "Role")}: ${roleLabel}`,
    "",
    `${tr("Abrir calendário", "Open calendar")}: ${shareUrl}`,
    "",
    tr(
      "Não é necessário criar conta - o link é pessoal.",
      "No account needed - this link is personal to you.",
    ),
  ].join("\n");

  return { subject, html, text };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
