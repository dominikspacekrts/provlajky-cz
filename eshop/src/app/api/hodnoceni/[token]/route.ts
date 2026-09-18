import { NextRequest, NextResponse } from "next/server";
import { sendOperatorMail } from "@/lib/customer-mail";
import {
  REVIEW_MAX_BODY,
  REVIEW_MAX_PHOTOS,
  REVIEW_PHOTO_BUCKET,
  isReviewToken,
} from "@/lib/reviews";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { createServiceClient } from "@/lib/supabase";

// Odeslání hodnocení z /hodnoceni/<token>. Jedno hodnocení na pozvánku —
// update jde jen na řádek ve stavu 'invited', takže dvojklik ani druhá
// záložka nic nepřepíše.

type Body = {
  rating?: number;
  body?: string;
  authorName?: string;
  authorRole?: string;
  allowPublish?: boolean;
  photos?: string[];
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function clip(s: unknown, max: number) {
  return String(s ?? "").trim().slice(0, max);
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ token: string }> }) {
  const { token } = await ctx.params;
  if (!isReviewToken(token)) return NextResponse.json({ error: "Neplatný odkaz." }, { status: 404 });

  const limited = rateLimit(`hodnoceni:${clientIp(req)}`, { limit: 10, windowMs: 10 * 60_000 });
  if (!limited.ok) return rateLimitResponse(limited.retryAfterSec);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const rating = Number(body.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: "Vyberte prosím počet hvězdiček." }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("id, status, order_id")
    .eq("token", token)
    .maybeSingle();
  if (!review) return NextResponse.json({ error: "Neplatný odkaz." }, { status: 404 });
  if (review.status !== "invited") {
    return NextResponse.json({ error: "Hodnocení už jste odeslali. Děkujeme!" }, { status: 409 });
  }

  // Přijmou se jen fotky, které k téhle pozvánce opravdu leží v úložišti.
  const { data: stored } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).list(review.id, { limit: 100 });
  const storedPaths = new Set((stored || []).map((f) => `${review.id}/${f.name}`));
  const photos = Array.from(new Set(Array.isArray(body.photos) ? body.photos : []))
    .filter((p): p is string => typeof p === "string" && storedPaths.has(p))
    .slice(0, REVIEW_MAX_PHOTOS);

  const text = clip(body.body, REVIEW_MAX_BODY);
  const authorName = clip(body.authorName, 80);
  const authorRole = clip(body.authorRole, 80);
  const allowPublish = body.allowPublish === true;

  const { data: updated, error } = await supabase
    .from("reviews")
    .update({
      status: "submitted",
      submitted_at: new Date().toISOString(),
      rating,
      body: text || null,
      author_name: authorName || null,
      author_role: authorRole || null,
      photos,
      allow_publish: allowPublish,
    })
    .eq("id", review.id)
    .eq("status", "invited")
    .select("id");
  if (error) {
    console.error("hodnoceni: update failed", error);
    return NextResponse.json({ error: "Hodnocení se nepodařilo uložit, zkuste to znovu." }, { status: 500 });
  }
  if (!updated?.length) {
    return NextResponse.json({ error: "Hodnocení už jste odeslali. Děkujeme!" }, { status: 409 });
  }

  // Fotky nahrané a pak v náhledu odebrané nemají v úložišti co dělat.
  const orphans = [...storedPaths].filter((p) => !photos.includes(p));
  if (orphans.length) {
    const { error: removeError } = await supabase.storage.from(REVIEW_PHOTO_BUCKET).remove(orphans);
    if (removeError) console.error("hodnoceni: orphan cleanup failed", removeError);
  }

  // Upozornění pro tým — jen informativní, výsledek pro zákazníka neovlivní.
  const { data: order } = review.order_id
    ? await supabase.from("orders").select("order_number").eq("id", review.order_id).maybeSingle()
    : { data: null };
  const stars = "★".repeat(rating) + "☆".repeat(5 - rating);
  await sendOperatorMail({
    subject: `Nové hodnocení ${stars}${order?.order_number ? ` — objednávka č. ${order.order_number}` : ""}`,
    html: `
      <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
        <p style="font-size: 22px; color: #eab308; margin: 0 0 8px;">${stars}</p>
        <p><strong>${escapeHtml(authorName || "Bez podpisu")}</strong>${authorRole ? ` · ${escapeHtml(authorRole)}` : ""}</p>
        ${text ? `<p style="white-space: pre-line; border-left: 2px solid #ffe701; padding-left: 12px;">${escapeHtml(text)}</p>` : ""}
        <p>Fotek: ${photos.length} · Souhlas se zveřejněním: ${allowPublish ? "ano" : "ne"}</p>
        <p style="color: #6b7280; font-size: 13px;">Zveřejnit jde v adminu v sekci Recenze.</p>
      </div>
    `,
  }).catch((e) => console.error("hodnoceni: operator mail failed", e));

  return NextResponse.json({ ok: true });
}
