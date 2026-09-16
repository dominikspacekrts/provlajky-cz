import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase/server";

// Jádro odesílání pošty. Jediné místo v celém projektu, které sahá na SMTP
// údaje — používá ho jak ruční odeslání z adminu (lib/actions/send-email.ts),
// tak brána pro eshop (app/api/mail/route.ts).
//
// Proč brána: eshop běžel jako samostatné nasazení a maily z něj nedorazily,
// zatímco ty z adminu se stejnými údaji chodily. Místo dvou cest k SMTP má
// teď eshop jen HTTP volání sem a o poštu se stará výhradně admin.

export type MailAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
  cid?: string;
};

export type DeliverMailInput = {
  /** Prázdné jen v kombinaci s toOperator. */
  to?: string;
  /** true = poslat na adresu provozovatele z nastavení (kontaktní formulář). */
  toOperator?: boolean;
  /** Adresa pro Odpovědět — u kontaktního formuláře odesílatel zprávy. */
  replyTo?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments?: MailAttachment[];
  kind?: string;
  orderId?: string | null;
  invoiceId?: string | null;
  /** E-mail člověka z týmu, nebo null = odeslal automat (eshop). */
  sentBy?: string | null;
};

export type DeliverMailResult = { ok: boolean; error?: string };

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

export async function deliverMail(input: DeliverMailInput): Promise<DeliverMailResult> {
  if (!input.to?.trim() && !input.toOperator) return { ok: false, error: "Chybí příjemce." };

  // Service client: bránu volá eshop bez přihlášené session, takže tady nelze
  // spoléhat na RLS přes is_allowed_user().
  const supabase = createServiceClient();
  const attachments = input.attachments ?? [];
  const attachmentsMeta = attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: Math.ceil((a.contentBase64.length * 3) / 4),
  }));

  // Adresa provozovatele je v nastavení, ne u volajícího — eshop ji tak vůbec
  // nemusí znát. Doplní se až po načtení nastavení níž.
  let toAddr = input.to?.trim() || "";

  const logResult = async (status: "sent" | "failed", errorMessage?: string) => {
    // sent_by = null u automatických mailů. Sloupec měl dřív "not null
    // references allowed_users(email)" a psal se do něj SMTP login, který tam
    // není — insert padal na cizí klíč a záznam se ztrácel, takže odeslání
    // nešlo dohledat (viz migrace 2026-09-email-history-system-sender.sql).
    const { error } = await supabase.from("email_history").insert({
      sent_by: input.sentBy ?? null,
      kind: input.kind || "other",
      order_id: input.orderId || null,
      invoice_id: input.invoiceId || null,
      to_addr: toAddr,
      cc: input.cc || [],
      bcc: input.bcc || [],
      subject: input.subject,
      html_body: input.html,
      attachments_meta: attachmentsMeta,
      status,
      error_message: errorMessage || null,
    });
    if (error) console.error("deliverMail: email_history log failed", error);
  };

  const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
  const mail = settingsRow?.mail as MailSettings | undefined;
  if (!mail?.host || !mail?.user) {
    // Nenastavené SMTP je konfigurační chyba, ne "není co posílat" — musí být
    // vidět v Historii mailů, jinak to vypadá, že se mail nikdy poslat neměl.
    const error = "Nejdřív nastav SMTP v Nastavení → Maily.";
    console.error(`deliverMail: ${error}`);
    await logResult("failed", error);
    return { ok: false, error };
  }

  if (!toAddr) {
    toAddr = mail.from || mail.user;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      auth: { user: mail.user, pass: mail.pass },
      // Bez limitů umí viset SMTP spojení déle, než žije serverless funkce.
      connectionTimeout: 8_000,
      greetingTimeout: 8_000,
      socketTimeout: 8_000,
    });

    await transporter.sendMail({
      from: `"${mail.fromName || "PROVLAJKY"}" <${mail.from || mail.user}>`,
      to: toAddr,
      replyTo: input.replyTo || undefined,
      cc: input.cc?.length ? input.cc.join(",") : undefined,
      bcc: input.bcc?.length ? input.bcc.join(",") : undefined,
      subject: input.subject,
      html: input.html,
      attachments: attachments.map((a) => ({
        filename: a.filename,
        content: Buffer.from(a.contentBase64, "base64"),
        contentType: a.contentType || "application/pdf",
        cid: a.cid,
      })),
    });

    await logResult("sent");
    return { ok: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba odeslání.";
    console.error("deliverMail: send failed", e);
    await logResult("failed", message);
    return { ok: false, error: message };
  }
}
