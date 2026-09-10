import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase";

// Kontaktní formulář (/kontakt) → e-mail na provozovatele (SMTP nastavení
// sdílené s registrací, viz api/registrace). Zprávu neukládáme do Supabase —
// jde jen o přeposlání e-mailem, reply-to je nastavené na odesílatele, ať se
// dá rovnou odpovědět.

type Body = { name?: string; email?: string; phone?: string; message?: string };

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function contactEmailHtml(name: string, email: string, phone: string | undefined, message: string): string {
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <p>Nová zpráva z kontaktního formuláře na provlajky.cz:</p>
      <p>
        <strong>Jméno:</strong> ${escapeHtml(name)}<br />
        <strong>E-mail:</strong> ${escapeHtml(email)}<br />
        ${phone ? `<strong>Telefon:</strong> ${escapeHtml(phone)}<br />` : ""}
      </p>
      <p style="white-space: pre-line; border-left: 2px solid #ffe701; padding-left: 12px;">${escapeHtml(message)}</p>
    </div>
  `;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const name = (body.name || "").trim();
  const email = (body.email || "").trim().toLowerCase();
  const phone = body.phone?.trim() || undefined;
  const message = (body.message || "").trim();

  if (!name) return NextResponse.json({ error: "Zadejte prosím jméno." }, { status: 400 });
  if (!isValidEmail(email)) return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Napište prosím zprávu." }, { status: 400 });

  const supabase = createServiceClient();
  const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
  const mail = settingsRow?.mail as MailSettings | undefined;

  if (!mail?.host || !mail?.user) {
    return NextResponse.json(
      { error: "Formulář teď nejde odeslat (SMTP není nastaveno) — napište nám prosím rovnou na info@provlajky.cz." },
      { status: 500 }
    );
  }

  const toAddr = mail.from || mail.user;
  const subject = `Zpráva z kontaktního formuláře — ${name}`;
  const html = contactEmailHtml(name, email, phone, message);

  const logResult = async (status: "sent" | "failed", errorMessage?: string) => {
    await supabase.from("email_history").insert({
      sent_by: mail.user,
      kind: "other",
      to_addr: toAddr,
      cc: [],
      bcc: [],
      subject,
      html_body: html,
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
      to: toAddr,
      replyTo: `"${name}" <${email}>`,
      subject,
      html,
    });

    await logResult("sent");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba odeslání.";
    await logResult("failed", message);
    return NextResponse.json(
      { error: "Zprávu se nepodařilo odeslat, zkuste to prosím znovu nebo napište na info@provlajky.cz." },
      { status: 500 }
    );
  }
}
