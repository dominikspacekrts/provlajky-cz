import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import {
  createSessionCookie,
  hashPassword,
  hashToken,
  isStrongEnoughPassword,
} from "@/lib/customer-auth";
import { loadCustomerProfile } from "@/lib/customer-profile";

type Body = { token?: string; password?: string };

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const raw = (body.token || "").trim();
  const password = body.password || "";
  if (!raw) return NextResponse.json({ error: "Chybí token." }, { status: 400 });
  if (!isStrongEnoughPassword(password)) {
    return NextResponse.json({ error: "Heslo musí mít alespoň 8 znaků." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const tokenHash = hashToken(raw);
  const { data: row } = await supabase
    .from("customer_password_tokens")
    .select("id, customer_id, expires_at, used_at")
    .eq("token_hash", tokenHash)
    .maybeSingle();

  if (!row || row.used_at || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ error: "Odkaz je neplatný nebo vypršel." }, { status: 400 });
  }

  const passwordHash = await hashPassword(password);
  const { error: updErr } = await supabase
    .from("customers")
    .update({
      password_hash: passwordHash,
      password_updated_at: new Date().toISOString(),
    })
    .eq("id", row.customer_id);
  if (updErr) {
    console.error("auth/set-password: update failed", updErr);
    return NextResponse.json({ error: "Heslo se nepodařilo uložit." }, { status: 500 });
  }

  await supabase
    .from("customer_password_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("id", row.id);

  await createSessionCookie(row.customer_id);
  const profile = await loadCustomerProfile(row.customer_id);
  return NextResponse.json({ ok: true, customer: profile });
}
