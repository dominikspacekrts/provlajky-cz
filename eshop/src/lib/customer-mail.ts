import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase";

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

async function getMailSettings(): Promise<MailSettings | null> {
  const supabase = createServiceClient();
  const { data } = await supabase.from("settings").select("mail").eq("id", 1).single();
  const mail = data?.mail as MailSettings | undefined;
  if (!mail?.host || !mail?.user) return null;
  return mail;
}

export async function sendCustomerMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ emailed: boolean; error?: string }> {
  const mail = await getMailSettings();
  if (!mail) {
    return { emailed: false, error: "SMTP není nastaveno." };
  }

  const supabase = createServiceClient();
  const logResult = async (status: "sent" | "failed", errorMessage?: string) => {
    await supabase.from("email_history").insert({
      sent_by: mail.user,
      kind: "other",
      to_addr: opts.to,
      cc: [],
      bcc: [],
      subject: opts.subject,
      html_body: opts.html,
      attachments_meta: [],
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
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
    });
    await logResult("sent");
    return { emailed: true };
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba odeslání.";
    await logResult("failed", message);
    return { emailed: false, error: message };
  }
}

export function discountCodeEmailHtml(name: string | undefined, code: string, pct: number): string {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : "Ahoj,";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>děkujeme za registraci na provlajky.cz. Váš slevový kód na <strong>${pct} %</strong> z první objednávky:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #ffe701; color: #08080a; padding: 12px 20px; display: inline-block;">${escapeHtml(code)}</p>
      <p>Kód zadejte v objednávce a klikněte na „Uplatnit“. Platí jednorázově na jednu objednávku.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}

export function passwordLinkEmailHtml(name: string | undefined, link: string, kind: "set_password" | "reset_password"): string {
  const greeting = name ? `Ahoj ${escapeHtml(name)},` : "Ahoj,";
  const lead =
    kind === "set_password"
      ? "pro dokončení účtu na provlajky.cz si nastavte heslo na tomto odkazu (platí 24 hodin):"
      : "pro obnovení hesla na provlajky.cz použijte tento odkaz (platí 24 hodin):";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>${lead}</p>
      <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#ffe701;color:#08080a;padding:12px 20px;font-weight:bold;text-decoration:none;">Nastavit heslo</a></p>
      <p style="font-size:12px;color:#666;">Pokud jste o to nežádali, e-mail ignorujte.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}
