"use server";

import fs from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";
import { createClient } from "@/lib/supabase/server";
import type { EmailKind } from "@/lib/types";

export type SendEmailAttachment = {
  filename: string;
  contentBase64: string;
  contentType?: string;
  cid?: string;
};

export type SendEmailInput = {
  kind: EmailKind;
  orderId?: string | null;
  invoiceId?: string | null;
  to: string;
  cc: string[];
  bcc?: string[];
  subject: string;
  html: string;
  attachments: SendEmailAttachment[];
};

export type SendEmailResult = { ok: boolean; error?: string };

let logoB64Cache: string | null | undefined;
async function getLogoAttachment(): Promise<SendEmailAttachment | null> {
  if (logoB64Cache === undefined) {
    try {
      const bytes = await fs.readFile(path.join(process.cwd(), "src/lib/assets/provlajky-logo.png"));
      logoB64Cache = bytes.toString("base64");
    } catch {
      logoB64Cache = null;
    }
  }
  if (!logoB64Cache) return null;
  return { filename: "logo.png", contentBase64: logoB64Cache, contentType: "image/png", cid: "provlajkylogo" };
}

// The single place in the whole app that touches SMTP credentials + sends mail.
// Every call — success or failure — is logged to email_history so nothing can
// bypass the audit trail (this is what the "Historie mailů" page reads from).
export async function sendEmailAction(input: SendEmailInput): Promise<SendEmailResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Nejsi přihlášený." };

  const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
  const mail = settingsRow?.mail as
    | { host: string; port: number; secure: boolean; user: string; pass: string; fromName?: string; from?: string }
    | undefined;

  if (!mail?.host || !mail?.user) {
    return { ok: false, error: "Nejdřív nastav SMTP v Nastavení → Maily." };
  }
  if (!input.to) {
    return { ok: false, error: "Chybí příjemce." };
  }

  const logoAtt = await getLogoAttachment();
  const attachments = [...(logoAtt ? [logoAtt] : []), ...input.attachments];
  const attachmentsMeta = attachments.map((a) => ({
    filename: a.filename,
    contentType: a.contentType,
    sizeBytes: Math.ceil((a.contentBase64.length * 3) / 4),
  }));

  const logResult = async (status: "sent" | "failed", errorMessage?: string) => {
    await supabase.from("email_history").insert({
      sent_by: user.email,
      kind: input.kind,
      order_id: input.orderId || null,
      invoice_id: input.invoiceId || null,
      to_addr: input.to,
      cc: input.cc || [],
      bcc: input.bcc || [],
      subject: input.subject,
      html_body: input.html,
      attachments_meta: attachmentsMeta,
      status,
      error_message: errorMessage || null,
    });
  };

  try {
    const transporter = nodemailer.createTransport({
      host: mail.host,
      port: Number(mail.port) || 587,
      secure: !!mail.secure,
      auth: { user: mail.user, pass: mail.pass },
    });

    const fromName = mail.fromName || "PROVLAJKY";
    const fromAddr = mail.from || mail.user;

    await transporter.sendMail({
      from: `"${fromName}" <${fromAddr}>`,
      to: input.to,
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
    await logResult("failed", message);
    return { ok: false, error: message };
  }
}
