"use server";

import { createClient } from "@/lib/supabase/server";
import { deliverMail, type MailAttachment } from "@/lib/mail/deliver";
import { getLogoAttachment } from "@/lib/mail/logo";
import type { EmailKind } from "@/lib/types";

export type SendEmailAttachment = MailAttachment;

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

// Ruční odeslání z adminu (faktura, vizualizace, účetní, dodavatel). Samotné
// odeslání i zápis do email_history řeší deliverMail — tady zbývá jen ověřit,
// že je uživatel přihlášený, a přibalit logo do hlavičky.
export async function sendEmailAction(input: SendEmailInput): Promise<SendEmailResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return { ok: false, error: "Nejsi přihlášený." };

  const logoAtt = await getLogoAttachment();

  return deliverMail({
    to: input.to,
    cc: input.cc,
    bcc: input.bcc,
    subject: input.subject,
    html: input.html,
    attachments: [...(logoAtt ? [logoAtt] : []), ...input.attachments],
    kind: input.kind,
    orderId: input.orderId,
    invoiceId: input.invoiceId,
    sentBy: user.email,
  });
}
