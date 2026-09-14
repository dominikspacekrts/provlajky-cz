import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import {
  createSessionCookie,
  DEFAULT_DISCOUNT_PCT,
  generateDiscountCode,
  hashPassword,
  isStrongEnoughPassword,
  verifyPassword,
} from "@/lib/customer-auth";
import { discountCodeEmailHtml, sendCustomerMail } from "@/lib/customer-mail";
import { loadCustomerProfile } from "@/lib/customer-profile";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

type Body = {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
};

async function trySendDiscountMail(
  email: string,
  name: string | undefined,
  discountCode: string,
  discountPct: number,
): Promise<boolean> {
  try {
    const mail = await sendCustomerMail({
      to: email,
      subject: "Váš slevový kód — provlajky.cz",
      html: discountCodeEmailHtml(name, discountCode, discountPct),
    });
    return mail.emailed;
  } catch (e) {
    console.error("auth/register: mail failed", e);
    return false;
  }
}

async function finishRegister(opts: {
  customerId: string;
  sessionVersion: number;
  discountCode: string;
  emailed: boolean;
}) {
  // Session cookie nesmí shodit už vytvořený účet — při chybě účet stejně vrátíme.
  try {
    await createSessionCookie(opts.customerId, opts.sessionVersion);
  } catch (e) {
    console.error("auth/register: session cookie failed", e);
  }

  const profile = await loadCustomerProfile(opts.customerId);
  return NextResponse.json({
    ok: true,
    emailed: opts.emailed,
    discountCode: opts.discountCode,
    customer: profile,
  });
}

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`register:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  const name = body.name?.trim() || undefined;
  const phone = body.phone?.trim() || undefined;

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Zadejte platný e-mail." }, { status: 400 });
  }
  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json(
      { error: "Heslo musí mít alespoň 8 znaků, jedno písmeno a jednu číslici." },
      { status: 400 },
    );
  }

  const supabase = createServiceClient();
  const passwordHash = await hashPassword(password);

  const { data: existing } = await supabase
    .from("customers")
    .select("id, discount_code, discount_pct, password_hash, name, used_at, session_version")
    .eq("email", email)
    .maybeSingle();

  // Idempotentní retry: účet už vznikl při předchozím „neúspěchu“, stejné heslo → přihlásit.
  if (existing?.password_hash) {
    const match = await verifyPassword(password, existing.password_hash);
    if (!match) {
      return NextResponse.json(
        { error: "Účet s tímto e-mailem už existuje. Přihlaste se, nebo použijte obnovení hesla." },
        { status: 409 },
      );
    }

    let emailed = false;
    if (!existing.used_at && existing.discount_code) {
      emailed = await trySendDiscountMail(
        email,
        name || existing.name || undefined,
        existing.discount_code,
        Number(existing.discount_pct) || DEFAULT_DISCOUNT_PCT,
      );
    }

    return finishRegister({
      customerId: existing.id,
      sessionVersion: Number(existing.session_version) || 1,
      discountCode: existing.discount_code,
      emailed,
    });
  }

  let customerId: string;
  let discountCode: string;
  let discountPct = DEFAULT_DISCOUNT_PCT;
  let emailedCode = false;
  let isNewCustomer = false;

  if (existing) {
    // Lead bez hesla (sleva e-mailem) → dokončení účtu.
    const { error } = await supabase
      .from("customers")
      .update({
        password_hash: passwordHash,
        password_updated_at: new Date().toISOString(),
        session_version: 1,
        name: name || existing.name,
        phone: phone || null,
      })
      .eq("id", existing.id);
    if (error) {
      console.error("auth/register: update failed", error);
      return NextResponse.json({ error: "Registraci se nepodařilo dokončit." }, { status: 500 });
    }
    customerId = existing.id;
    discountCode = existing.discount_code;
    discountPct = Number(existing.discount_pct) || DEFAULT_DISCOUNT_PCT;
  } else {
    discountCode = generateDiscountCode();
    let attempts = 0;
    let insertedId: string | null = null;
    while (!insertedId && attempts < 5) {
      const { data, error } = await supabase
        .from("customers")
        .insert({
          email,
          name: name || null,
          phone: phone || null,
          discount_code: discountCode,
          discount_pct: DEFAULT_DISCOUNT_PCT,
          password_hash: passwordHash,
          password_updated_at: new Date().toISOString(),
          session_version: 1,
        })
        .select("id")
        .single();
      if (!error && data) {
        insertedId = data.id;
      } else if (error?.code === "23505") {
        // Paralelní registrace / kolize kódu — zkus znovu načíst existující.
        const { data: raced } = await supabase
          .from("customers")
          .select("id, discount_code, discount_pct, password_hash, session_version, used_at, name")
          .eq("email", email)
          .maybeSingle();
        if (raced?.password_hash) {
          const match = await verifyPassword(password, raced.password_hash);
          if (match) {
            return finishRegister({
              customerId: raced.id,
              sessionVersion: Number(raced.session_version) || 1,
              discountCode: raced.discount_code,
              emailed: false,
            });
          }
          return NextResponse.json(
            { error: "Účet s tímto e-mailem už existuje. Přihlaste se, nebo použijte obnovení hesla." },
            { status: 409 },
          );
        }
        discountCode = generateDiscountCode();
        attempts++;
      } else {
        console.error("auth/register: insert failed", error);
        return NextResponse.json({ error: "Registraci se nepodařilo dokončit." }, { status: 500 });
      }
    }
    if (!insertedId) {
      return NextResponse.json({ error: "Registraci se nepodařilo dokončit." }, { status: 500 });
    }
    customerId = insertedId;
    isNewCustomer = true;
  }

  // Mail až po úspěšném zápisu; jeho selhání nesmí zrušit registraci.
  if (isNewCustomer || (existing && !existing.used_at)) {
    emailedCode = await trySendDiscountMail(email, name || existing?.name || undefined, discountCode, discountPct);
  }

  return finishRegister({
    customerId,
    sessionVersion: 1,
    discountCode,
    emailed: emailedCode,
  });
}
