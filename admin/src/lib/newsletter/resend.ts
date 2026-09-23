export type ResendAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
  contentId?: string;
};

export type ResendSendInput = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
  attachments?: ResendAttachment[];
};

export type ResendSendResult = { ok: true; id: string } | { ok: false; error: string };

function resendConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || "";
  const fromName = process.env.RESEND_FROM_NAME?.trim() || "PROVLAJKY";
  return { apiKey, fromEmail, fromName };
}

export function resendConfigured(): boolean {
  const { apiKey, fromEmail } = resendConfig();
  return Boolean(apiKey && fromEmail);
}

export function resendConfigError(): string | null {
  const { apiKey, fromEmail } = resendConfig();
  if (!apiKey) return "Chybí RESEND_API_KEY v prostředí adminu.";
  if (!fromEmail) return "Chybí RESEND_FROM_EMAIL (ověřená adresa v Resend).";
  return null;
}

/** Pošle jeden HTML mail přes Resend API. Bez SDK — stačí fetch. */
export async function sendViaResend(input: ResendSendInput): Promise<ResendSendResult> {
  const cfgErr = resendConfigError();
  if (cfgErr) return { ok: false, error: cfgErr };

  const { apiKey, fromEmail, fromName } = resendConfig();
  const from = `${fromName} <${fromEmail}>`;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.replyTo ? { reply_to: input.replyTo } : {}),
        ...(input.attachments?.length
          ? {
              attachments: input.attachments.map((a) => ({
                filename: a.filename,
                content: a.contentBase64,
                content_type: a.contentType || "application/octet-stream",
                ...(a.contentId ? { content_id: a.contentId } : {}),
              })),
            }
          : {}),
      }),
      signal: AbortSignal.timeout(20_000),
    });

    const json = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
    if (!res.ok) {
      return {
        ok: false,
        error: json.message || json.name || `Resend odpověděl ${res.status}.`,
      };
    }
    if (!json.id) return { ok: false, error: "Resend nevrátil id zprávy." };
    return { ok: true, id: json.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Resend je nedostupný." };
  }
}

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
