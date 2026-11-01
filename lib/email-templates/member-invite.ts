import { absoluteUrl } from "@/lib/app-url";
import { localizedText, type AppLocale } from "@/lib/locale";

export interface MemberInviteEmailParams {
  memberEmail: string;
  memberName: string;
  organizationName: string;
  role: "admin" | "member";
  invitedByName?: string | null;
  locale: AppLocale;
}

const ROLE_LABELS: Record<AppLocale, Record<string, string>> = {
  "pt-BR": {
    admin: "Administrador",
    member: "Membro",
  },
  en: {
    admin: "Admin",
    member: "Member",
  },
};

export function buildMemberInviteEmail(params: MemberInviteEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { locale } = params;
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);
  const loginUrl = absoluteUrl(`/invite?email=${encodeURIComponent(params.memberEmail)}`);
  const roleLabel = ROLE_LABELS[locale][params.role] || ROLE_LABELS[locale].member;
  const inviterLine = params.invitedByName
    ? tr(
        `${escapeHtml(params.invitedByName)} convidou você para fazer parte da equipe <strong>${escapeHtml(params.organizationName)}</strong> no Approove.`,
        `${escapeHtml(params.invitedByName)} invited you to join the <strong>${escapeHtml(params.organizationName)}</strong> team on Approove.`,
      )
    : tr(
        `Você foi convidado para fazer parte da equipe <strong>${escapeHtml(params.organizationName)}</strong> no Approove.`,
        `You've been invited to join the <strong>${escapeHtml(params.organizationName)}</strong> team on Approove.`,
      );

  const subject = tr(
    `${params.organizationName} - convite para a equipe`,
    `${params.organizationName} - team invitation`,
  );

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;">Approove</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b;">${tr("Olá", "Hi")}, ${escapeHtml(params.memberName)}</h1>
    <p style="margin:0 0 16px;color:#52525b;font-size:14px;line-height:1.5;">
      ${inviterLine}
    </p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 24px;font-size:14px;">
      <tr>
        <td style="padding:8px 0;color:#71717a;vertical-align:top;">${tr("Organização", "Organization")}</td>
        <td style="padding:8px 0;color:#18181b;font-weight:500;">${escapeHtml(params.organizationName)}</td>
      </tr>
      <tr>
        <td style="padding:8px 0;color:#71717a;vertical-align:top;">${tr("Seu papel", "Your role")}</td>
        <td style="padding:8px 0;color:#18181b;">${escapeHtml(roleLabel)}</td>
      </tr>
    </table>
    <a href="${loginUrl}" style="display:inline-block;background:#18181b;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:12px 20px;border-radius:8px;">
      ${tr("Entrar com código de acesso", "Sign in with an access code")}
    </a>
    <p style="margin:24px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;word-break:break-all;">
      ${tr("Ou copie este link:", "Or copy this link:")} <a href="${loginUrl}" style="color:#52525b;">${loginUrl}</a>
    </p>
    <p style="margin:16px 0 0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      ${tr(
        "Ao clicar, você receberá um código de 6 dígitos no seu e-mail para fazer login. Se você não esperava este convite, ignore este e-mail.",
        "When you click, you'll receive a 6-digit code by email to sign in. If you weren't expecting this invitation, you can ignore this email.",
      )}
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${tr("Olá", "Hi")}, ${params.memberName}`,
    "",
    params.invitedByName
      ? tr(
          `${params.invitedByName} convidou você para fazer parte da equipe ${params.organizationName} no Approove.`,
          `${params.invitedByName} invited you to join the ${params.organizationName} team on Approove.`,
        )
      : tr(
          `Você foi convidado para fazer parte da equipe ${params.organizationName} no Approove.`,
          `You've been invited to join the ${params.organizationName} team on Approove.`,
        ),
    "",
    `${tr("Organização", "Organization")}: ${params.organizationName}`,
    `${tr("Papel", "Role")}: ${roleLabel}`,
    "",
    `${tr("Acessar", "Open")}: ${loginUrl}`,
    "",
    tr(
      "Ao clicar, você receberá um código de 6 dígitos no seu e-mail para fazer login.",
      "When you click, you'll receive a 6-digit code by email to sign in.",
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
