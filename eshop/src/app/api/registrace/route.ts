import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import {
  DEFAULT_DISCOUNT_PCT,
  generateDiscountCode,
} from "@/lib/customer-auth";
import { discountCodeEmailHtml, sendCustomerMail } from "@/lib/customer-mail";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

type Body = { name?: string; email?: string; phone?: string };

/**
 * Sleva 10 % e-mailem — jen e-mail (bez hesla). Účet s heslem je /api/auth/register.
 * Existující e-mail: znovu pošleme stejný kód jen když ještě nebyl použitý (+ rate limit).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`sleva:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

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

  const emailLimited = rateLimit(`sleva-email:${email}`, { limit: 2, windowMs: 15 * 60_000 });
  if (!emailLimited.ok) {
    return NextResponse.json({
      ok: true,
      emailed: true,
      message: "Pokud e-mail známe, kód jsme už poslali. Zkontrolujte schránku (i spam).",
    });
  }

  const supabase = createServiceClient();
  const { data: existing } = await supabase
    .from("customers")
    .select("id, discount_code, discount_pct, used_at, name")
    .eq("email", email)
    .maybeSingle();

  let discountCode: string;
  let discountPct = DEFAULT_DISCOUNT_PCT;

  if (existing) {
    if (existing.used_at) {
      return NextResponse.json({
        ok: true,
        emailed: false,
        message: "Slevový kód u tohoto e-mailu už byl uplatněn.",
      });
    }
    discountCode = existing.discount_code;
    discountPct = Number(existing.discount_pct) || DEFAULT_DISCOUNT_PCT;
  } else {
    discountCode = generateDiscountCode();
    let attempts = 0;
    let inserted = false;
    while (!inserted && attempts < 5) {
      const { error } = await supabase.from("customers").insert({
        email,
        name: name || null,
        phone: phone || null,
        discount_code: discountCode,
        discount_pct: DEFAULT_DISCOUNT_PCT,
      });
      if (!error) {
        inserted = true;
      } else if (error.code === "23505") {
        discountCode = generateDiscountCode();
        attempts++;
      } else {
        console.error("registrace/sleva: insert failed", error);
        return NextResponse.json({ error: "Nepodařilo se dokončit, zkuste to znovu." }, { status: 500 });
      }
    }
    if (!inserted) {
      return NextResponse.json({ error: "Nepodařilo se dokončit, zkuste to znovu." }, { status: 500 });
    }
  }

  const mail = await sendCustomerMail({
    to: email,
    subject: "Váš slevový kód — provlajky.cz",
    html: discountCodeEmailHtml(name || existing?.name || undefined, discountCode, discountPct),
  });

  if (!mail.emailed) {
    return NextResponse.json({
      ok: true,
      emailed: false,
      message: "Registrace proběhla, ale e-mail se teď nepodařilo odeslat — ozvěte se na info@provlajky.cz.",
    });
  }

  return NextResponse.json({
    ok: true,
    emailed: true,
    message: "Kód s 10% slevou jsme poslali na e-mail.",
  });
}
