import { NextRequest, NextResponse } from "next/server";
import { isValidEmail } from "@/lib/validation";
import { sendOperatorMail } from "@/lib/customer-mail";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

// Kontaktní formulář (/kontakt) → e-mail na provozovatele. Odesílá ho admin
// přes mailovou bránu, adresu příjemce zná z nastavení. Zprávu neukládáme do
// Supabase — jde jen o přeposlání e-mailem, reply-to je nastavené na
// odesílatele, ať se dá rovnou odpovědět.

type Body = { name?: string; email?: string; phone?: string; message?: string };

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
  const ip = clientIp(req);
  const limited = rateLimit(`kontakt:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

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

  const sent = await sendOperatorMail({
    subject: `Zpráva z kontaktního formuláře — ${name}`,
    html: contactEmailHtml(name, email, phone, message),
    replyTo: `"${name.replace(/"/g, "")}" <${email}>`,
  });

  if (!sent.emailed) {
    console.error("kontakt: odeslání selhalo", sent.error);
    return NextResponse.json(
      { error: "Zprávu se nepodařilo odeslat, zkuste to prosím znovu nebo napište na info@provlajky.cz." },
      { status: 500 }
    );
  }
  return NextResponse.json({ ok: true });
}
