import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import { createSessionCookie, verifyPassword } from "@/lib/customer-auth";
import { loadCustomerProfile } from "@/lib/customer-profile";

type Body = { email?: string; password?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const email = (body.email || "").trim().toLowerCase();
  const password = body.password || "";
  if (!isValidEmail(email) || !password) {
    return NextResponse.json({ error: "Zadejte e-mail a heslo." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, password_hash")
    .eq("email", email)
    .maybeSingle();

  if (!customer) {
    return NextResponse.json({ error: "Neplatný e-mail nebo heslo." }, { status: 401 });
  }
  if (!customer.password_hash) {
    return NextResponse.json(
      {
        error: "Účet ještě nemá heslo. Použijte „Nastavit heslo“ — pošleme odkaz na e-mail.",
        needsPassword: true,
      },
      { status: 403 },
    );
  }

  const ok = await verifyPassword(password, customer.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Neplatný e-mail nebo heslo." }, { status: 401 });
  }

  await createSessionCookie(customer.id);
  const profile = await loadCustomerProfile(customer.id);
  return NextResponse.json({ ok: true, customer: profile });
}
