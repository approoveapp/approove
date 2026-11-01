export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  id?: string;
  error?: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim() && process.env.EMAIL_FROM?.trim());
}

export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    console.warn("[email] RESEND_API_KEY or EMAIL_FROM not configured - skipping send");
    return { ok: false, skipped: true };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        text: params.text,
      }),
    });

    const data = (await res.json()) as { id?: string; message?: string };

    if (!res.ok) {
      const message = typeof data.message === "string" ? data.message : "Failed to send email";
      console.error("[email] Resend:", message);
      return { ok: false, error: message };
    }

    return { ok: true, id: data.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to send email";
    console.error("[email] send failed:", error);
    return { ok: false, error: message };
  }
}
