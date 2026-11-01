import { localizedText, type AppLocale } from "@/lib/locale";

export interface LoginCodeEmailParams {
  name: string;
  code: string;
  locale: AppLocale;
}

export function buildLoginCodeEmail(params: LoginCodeEmailParams): {
  subject: string;
  html: string;
  text: string;
} {
  const { locale } = params;
  const tr = (pt: string, en: string) => localizedText(locale, pt, en);

  const subject = tr(
    `${params.code} - seu código de acesso ao Approove`,
    `${params.code} - your Approove access code`,
  );

  const html = `<!DOCTYPE html>
<html lang="${locale}">
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:24px;background:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;border:1px solid #e4e4e7;">
    <p style="margin:0 0 8px;font-size:12px;font-weight:600;letter-spacing:0.05em;text-transform:uppercase;color:#71717a;">Approove</p>
    <h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:#18181b;">${tr("Olá", "Hi")}, ${escapeHtml(params.name)}</h1>
    <p style="margin:0 0 24px;color:#52525b;font-size:14px;line-height:1.5;">
      ${tr(
        "Use o código abaixo para acessar sua conta. Ele é válido por 10 minutos.",
        "Use the code below to sign in to your account. It is valid for 10 minutes.",
      )}
    </p>
    <div style="background:#f4f4f5;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
      <span style="font-size:32px;font-weight:700;letter-spacing:0.3em;color:#18181b;font-family:monospace;">${params.code}</span>
    </div>
    <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.5;">
      ${tr(
        "Se você não solicitou este código, ignore este e-mail.",
        "If you didn't request this code, you can ignore this email.",
      )}
    </p>
  </div>
</body>
</html>`;

  const text = [
    `${tr("Olá", "Hi")}, ${params.name}`,
    "",
    tr(
      "Use o código abaixo para acessar sua conta no Approove:",
      "Use the code below to sign in to your Approove account:",
    ),
    "",
    `  ${params.code}`,
    "",
    tr("O código é válido por 10 minutos.", "The code is valid for 10 minutes."),
    "",
    tr(
      "Se você não solicitou este código, ignore este e-mail.",
      "If you didn't request this code, you can ignore this email.",
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
