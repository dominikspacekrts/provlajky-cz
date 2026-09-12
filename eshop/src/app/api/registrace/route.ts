import { NextRequest, NextResponse } from "next/server";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";

/**
 * Legacy endpoint — dřív e-mail-only registrace se znovuodesláním kódu.
 * Ponecháno kvůli starým odkazům; nové registrace jdou přes /api/auth/register.
 * Záměrně neposílá znovu slevový kód (spam / enumerace).
 */
export async function POST(req: NextRequest) {
  const ip = clientIp(req);
  const limited = rateLimit(`registrace-legacy:${ip}`, { limit: 5, windowMs: 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  // Body spotřebujeme, ať klient nečeká hang.
  try {
    await req.json();
  } catch {
    /* ignore */
  }

  return NextResponse.json(
    {
      error: "Registrace teď probíhá s heslem. Použijte stránku /registrace.",
      redirect: "/registrace",
    },
    { status: 410 },
  );
}
