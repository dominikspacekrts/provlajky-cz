import { readSecret, SecretsTableMissingError } from "@/lib/secrets";

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

export const RESEND_SECRET_NAME = "resend";

export type StoredResendSettings = { apiKey: string; fromEmail: string; fromName: string };

export type ResendConfig = {
  apiKey: string;
  fromEmail: string;
  fromName: string;
  /** Odkud konfigurace je: admin → Nastavení, proměnné prostředí na Vercelu, nebo nikde. */
  source: "settings" | "env" | "none";
  /** Maskovaný klíč pro zobrazení (re_…ab12). */
  hint: string | null;
  updatedAt: string | null;
  tableMissing: boolean;
};

export function maskApiKey(key: string): string {
  const k = key.trim();
  if (k.length <= 8) return "••••";
  return `${k.slice(0, 3)}…${k.slice(-4)}`;
}

/** Klíč zadaný v adminu má přednost; bez něj se použijí RESEND_* proměnné prostředí. */
export async function loadResendConfig(): Promise<ResendConfig> {
  let tableMissing = false;
  try {
    const stored = await readSecret<StoredResendSettings>(RESEND_SECRET_NAME);
    if (stored?.value.apiKey) {
      return {
        apiKey: stored.value.apiKey,
        fromEmail: stored.value.fromEmail || process.env.RESEND_FROM_EMAIL?.trim() || "",
        fromName: stored.value.fromName || process.env.RESEND_FROM_NAME?.trim() || "PROVLAJKY",
        source: "settings",
        hint: stored.meta.hint,
        updatedAt: stored.meta.updatedAt,
        tableMissing: false,
      };
    }
  } catch (e) {
    if (e instanceof SecretsTableMissingError) tableMissing = true;
    else console.error("loadResendConfig: čtení uloženého klíče selhalo", e);
  }
  const apiKey = process.env.RESEND_API_KEY?.trim() || "";
  return {
    apiKey,
    fromEmail: process.env.RESEND_FROM_EMAIL?.trim() || "",
    fromName: process.env.RESEND_FROM_NAME?.trim() || "PROVLAJKY",
    source: apiKey ? "env" : "none",
    hint: apiKey ? maskApiKey(apiKey) : null,
    updatedAt: null,
    tableMissing,
  };
}

export function resendConfigError(cfg: ResendConfig): string | null {
  if (!cfg.apiKey) return "Chybí Resend API klíč — zadej ho v Nastavení → Newsletter.";
  if (!cfg.fromEmail) return "Chybí e-mail odesílatele pro Resend — doplň ho v Nastavení → Newsletter.";
  return null;
}

/** Pošle jeden HTML mail přes Resend API. Bez SDK — stačí fetch. */
export async function sendViaResend(input: ResendSendInput, cfg: ResendConfig): Promise<ResendSendResult> {
  const cfgErr = resendConfigError(cfg);
  if (cfgErr) return { ok: false, error: cfgErr };

  const { apiKey, fromEmail, fromName } = cfg;
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
