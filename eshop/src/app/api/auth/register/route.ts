import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import {
  createSessionCookie,
  DEFAULT_DISCOUNT_PCT,
  generateDiscountCode,
  hashPassword,
  isStrongEnoughPassword,
} from "@/lib/customer-auth";
import { discountCodeEmailHtml, sendCustomerMail } from "@/lib/customer-mail";
import { loadCustomerProfile } from "@/lib/customer-profile";

type Body = {
  email?: string;
  password?: string;
  name?: string;
  phone?: string;
};

export async function POST(req: NextRequest) {
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
    return NextResponse.json({ error: "Heslo musí mít alespoň 8 znaků." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const passwordHash = await hashPassword(password);

  const { data: existing } = await supabase
    .from("customers")
    .select("id, discount_code, password_hash, name")
    .eq("email", email)
    .maybeSingle();

  let customerId: string;
  let discountCode: string;
  let emailedCode = false;

  if (existing?.password_hash) {
    return NextResponse.json({ error: "Účet s tímto e-mailem už existuje. Přihlaste se." }, { status: 409 });
  }

  if (existing) {
    // Starý lead bez hesla — dokončí účet, kód zůstane.
    const { error } = await supabase
      .from("customers")
      .update({
        password_hash: passwordHash,
        password_updated_at: new Date().toISOString(),
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
        })
        .select("id")
        .single();
      if (!error && data) {
        insertedId = data.id;
      } else if (error?.code === "23505") {
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

    const mail = await sendCustomerMail({
      to: email,
      subject: "Váš slevový kód — provlajky.cz",
      html: discountCodeEmailHtml(name, discountCode, DEFAULT_DISCOUNT_PCT),
    });
    emailedCode = mail.emailed;
  }

  await createSessionCookie(customerId);
  const profile = await loadCustomerProfile(customerId);
  return NextResponse.json({
    ok: true,
    emailed: emailedCode,
    discountCode,
    customer: profile,
  });
}
