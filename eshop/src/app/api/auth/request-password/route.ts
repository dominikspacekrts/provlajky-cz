import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import { SITE_URL } from "@/lib/site";
import { generateRawToken, hashToken } from "@/lib/customer-auth";
import { passwordLinkEmailHtml, sendCustomerMail } from "@/lib/customer-mail";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

type Body = { email?: string };

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`request-password:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  }

  // Per-email cooldown — ochrana inboxu.
  const emailLimited = rateLimit(`request-password-email:${email}`, { limit: 3, windowMs: 15 * 60_000 });
  if (!emailLimited.ok) {
    return NextResponse.json({
      ok: true,
      message: "Pokud účet existuje, poslali jsme odkaz na e-mail.",
    });
  }

  const supabase = createServiceClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, name, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({
      ok: true,
      message: "Pokud účet existuje, poslali jsme odkaz na e-mail.",
    });
  }

  const kind = customer.password_hash ? "reset_password" : "set_password";
  const raw = generateRawToken();
  const tokenHash = hashToken(raw);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

  await supabase.from("customer_password_tokens").insert({
    customer_id: customer.id,
    token_hash: tokenHash,
    kind,
    expires_at: expiresAt,
  });

  const link = `${SITE_URL.replace(/\/$/, "")}/nastavit-heslo?token=${encodeURIComponent(raw)}`;
  const mail = await sendCustomerMail({
    to: email,
    subject: kind === "set_password" ? "Dokončení účtu — provlajky.cz" : "Obnovení hesla — provlajky.cz",
    html: passwordLinkEmailHtml(customer.name || undefined, link, kind),
  });

  if (!mail.emailed) {
    return NextResponse.json({
      ok: true,
      message: "Odkaz se nepodařilo odeslat e-mailem. Ozvěte se nám na info@provlajky.cz.",
      emailed: false,
    });
  }

  return NextResponse.json({
    ok: true,
    emailed: true,
    message: "Pokud účet existuje, poslali jsme odkaz na e-mail.",
  });
}
