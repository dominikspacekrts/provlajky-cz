import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { isValidEmail } from "@/lib/validation";
import { createSessionCookie, verifyPassword } from "@/lib/customer-auth";
import { getCustomerSessionVersion, loadCustomerProfile } from "@/lib/customer-profile";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

type Body = { email?: string; password?: string };

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`login:${ip}`, { limit: 10, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

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

  // Stejná odpověď pro neexistující účet / špatné heslo / účet bez hesla —
  // ať se nedá zjišťovat registrace.
  if (!customer?.password_hash) {
    return NextResponse.json({ error: "Neplatný e-mail nebo heslo." }, { status: 401 });
  }

  const ok = await verifyPassword(password, customer.password_hash);
  if (!ok) {
    return NextResponse.json({ error: "Neplatný e-mail nebo heslo." }, { status: 401 });
  }

  const sv = await getCustomerSessionVersion(customer.id);
  await createSessionCookie(customer.id, sv);
  const profile = await loadCustomerProfile(customer.id);
  return NextResponse.json({ ok: true, customer: profile });
}
