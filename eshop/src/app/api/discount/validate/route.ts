import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

type Body = { code?: string };

export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`discount:${ip}`, { limit: 20, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Neplatná data." }, { status: 400 });
  }

  const code = (body.code || "").trim().toUpperCase();
  if (!code) {
    return NextResponse.json({ ok: false, message: "Zadejte slevový kód." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: customer, error } = await supabase
    .from("customers")
    .select("discount_pct, used_at")
    .eq("discount_code", code)
    .maybeSingle();

  if (error) {
    console.error("discount/validate: lookup failed", error);
    return NextResponse.json({ ok: false, message: "Kód se teď nepodařilo ověřit." }, { status: 500 });
  }

  if (!customer) {
    return NextResponse.json({ ok: false, message: "Slevový kód je neplatný." });
  }
  if (customer.used_at) {
    return NextResponse.json({ ok: false, message: "Slevový kód už byl použitý." });
  }

  return NextResponse.json({
    ok: true,
    discountPct: Number(customer.discount_pct) || 0,
    message: `Sleva ${Number(customer.discount_pct) || 0} % bude odečtena z mezisoučtu.`,
  });
}
