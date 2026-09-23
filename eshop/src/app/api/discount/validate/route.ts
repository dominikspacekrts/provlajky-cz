import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { resolveDiscountCode } from "@/lib/promo-codes";

type Body = { code?: string; subtotalEx?: number };

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

  const code = (body.code || "").trim();
  if (!code) {
    return NextResponse.json({ ok: false, message: "Zadejte slevový kód." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const resolved = await resolveDiscountCode(supabase, code, Number(body.subtotalEx) || 0);
  if (!resolved.ok) {
    return NextResponse.json(
      { ok: false, message: resolved.message },
      { status: resolved.status || 200 }
    );
  }

  const d = resolved.discount;
  // U fixed bez subtotalu vrátíme discountPct 0 — checkout dopočítá. UI ukáže message.
  return NextResponse.json({
    ok: true,
    discountPct: d.discountPct,
    message: d.message,
  });
}
