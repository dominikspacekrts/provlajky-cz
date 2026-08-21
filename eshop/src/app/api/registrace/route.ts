import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase";

type Body = {
  name?: string;
  email: string;
  phone?: string;
};

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // bez znaků, co se pletou (0/O, 1/I/L)
const CODE_LENGTH = 8;
const DISCOUNT_PCT = 10;

function generateCode(): string {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return code;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function registrationEmailHtml(name: string | undefined, code: string): string {
  const greeting = name ? `Ahoj ${name},` : "Ahoj,";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${greeting}</p>
      <p>děkujeme za registraci na provlajky.cz. Váš slevový kód na <strong>${DISCOUNT_PCT} %</strong> z první objednávky:</p>
      <p style="font-size: 24px; font-weight: bold; letter-spacing: 4px; background: #ffe701; color: #08080a; padding: 12px 20px; display: inline-block;">${code}</p>
      <p>Kód zadejte v objednávce v poli „Slevový kód“. Platí jednorázově na jednu objednávku.</p>
      <p>Tým PROVLAJKY.CZ</p>
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

  const email = (body.email || "").trim().toLowerCase();
  const name = body.name?.trim() || undefined;
  const phone = body.phone?.trim() || undefined;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Už registrovaný? Pošleme znovu jeho stávající kód, nezaložíme duplicitu.
  const { data: existing } = await supabase
    .from("customers")
    .select("discount_code, name")
    .eq("email", email)
    .maybeSingle();

  let discountCode: string;
  if (existing) {
    discountCode = existing.discount_code;
  } else {
    discountCode = generateCode();
    let attempts = 0;
    let inserted = false;
    while (!inserted && attempts < 5) {
      const { error } = await supabase.from("customers").insert({
        email,
        name: name || null,
        phone: phone || null,
        discount_code: discountCode,
        discount_pct: DISCOUNT_PCT,
      });
      if (!error) {
        inserted = true;
      } else if (error.code === "23505") {
        // kolize unique constraintu (email nebo discount_code) — zkusit znovu s novým kódem
        discountCode = generateCode();
        attempts++;
      } else {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
    }
    if (!inserted) {
      return NextResponse.json({ error: "Nepodařilo se dokončit registraci, zkuste to prosím znovu." }, { status: 500 });
    }
  }

  const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
  const mail = settingsRow?.mail as MailSettings | undefined;

  if (!mail?.host || !mail?.user) {
    // SMTP zatím není v adminu nastavené — registrace i tak proběhla, kód
    // jen nešlo poslat mailem. Nefabulujeme úspěšné odeslání.
    return NextResponse.json(
      { ok: true, emailed: false, error: "Registrace proběhla, ale e-mail se nepodařilo odeslat (SMTP není nastaveno)." },
      { status: 200 }
    );
  }

  const subject = "Váš slevový kód — provlajky.cz";
  const html = registrationEmailHtml(name || existing?.name || undefined, discountCode);

  const logResult = async (status: "sent" | "failed", errorMessage?: string) => {
    await supabase.from("email_history").insert({
      sent_by: mail.user,
      kind: "other",
      to_addr: email,
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
      to: email,
      subject,
      html,
    });

    await logResult("sent");
    return NextResponse.json({ ok: true, emailed: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Neznámá chyba odeslání.";
    await logResult("failed", message);
    return NextResponse.json({ ok: true, emailed: false, error: `Registrace proběhla, ale e-mail se nepodařilo odeslat: ${message}` });
  }
}
