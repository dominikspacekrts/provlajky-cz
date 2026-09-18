import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { decodeSafeImageDataUrl } from "@/lib/safe-image";
import { REVIEW_MAX_PHOTO_BYTES, REVIEW_PHOTO_BUCKET, isReviewToken } from "@/lib/reviews";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

// Nahrání jedné fotky k hodnocení (/hodnoceni/<token>). Fotky se nahrávají
// hned po výběru, ne až s formulářem — zákazník vidí náhled a průběh a jeden
// velký požadavek s šesti fotkami by narazil na limit těla funkce na Vercelu.
// Co zákazník nakonec neodešle, smaže až odeslání hodnocení.

// Strop na všechny nahrané soubory k jedné pozvánce včetně smazaných
// v náhledu — ať odkaz nejde použít jako neomezené úložiště.
const MAX_UPLOADS_PER_REVIEW = 24;

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isReviewToken(token)) return NextResponse.json({ error: "Neplatný odkaz." }, { status: 404 });

  const limited = rateLimit(`hodnoceni-foto:${clientIp(req)}`, { limit: 30, windowMs: 10 * 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: { dataUrl?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: review } = await supabase.from("reviews").select("id, status").eq("token", token).maybeSingle();
  if (!review) return NextResponse.json({ error: "Neplatný odkaz." }, { status: 404 });
  if (review.status !== "invited") {
    return NextResponse.json({ error: "Hodnocení už je odeslané." }, { status: 409 });
  }

  const decoded = decodeSafeImageDataUrl(String(body.dataUrl || ""), REVIEW_MAX_PHOTO_BYTES);
  if (!decoded) {
    return NextResponse.json({ error: "Fotka musí být JPG, PNG nebo WEBP do 5 MB." }, { status: 400 });
  }

  const { data: existing } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).list(review.id, { limit: 100 });
  if ((existing?.length || 0) >= MAX_UPLOADS_PER_REVIEW) {
    return NextResponse.json({ error: "Víc fotek už nahrát nejde." }, { status: 400 });
  }

  const path = `${review.id}/${randomUUID()}.${decoded.ext}`;
  const { error } = await supabase.storage
    .from(REVIEW_PHOTO_BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: false });
  if (error) {
    console.error("hodnoceni/foto: upload failed", error);
    return NextResponse.json({ error: "Fotku se nepodařilo nahrát, zkuste to znovu." }, { status: 500 });
  }

  return NextResponse.json({ path });
}
