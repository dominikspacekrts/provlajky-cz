import { createServiceClient } from "@/lib/supabase";

// Recenze zákazníků — tabulka reviews (admin/supabase/2026-09-reviews.sql).
// Tabulka nemá žádnou veřejnou RLS policy (token nesmí jít přečíst přes
// anon klíč), takže se sem sahá jen ze serveru přes service klienta.

export const REVIEW_PHOTO_BUCKET = "review-photos";
export const REVIEW_MAX_PHOTOS = 6;
export const REVIEW_MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export const REVIEW_MAX_BODY = 2000;

const TOKEN_RE = /^[A-Za-z0-9_-]{20,64}$/;

export function isReviewToken(token: string) {
  return TOKEN_RE.test(token);
}

export function reviewPhotoUrl(path: string) {
  return `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${REVIEW_PHOTO_BUCKET}/${path}`;
}

export type ReviewInvite = {
  id: string;
  status: "invited" | "submitted";
  rating: number | null;
  orderNumber: string | null;
  /** Předvyplněný podpis — firma nebo jméno z fakturační adresy. */
  defaultName: string;
  defaultRole: string;
  items: string[];
};

export async function loadReviewInvite(token: string): Promise<ReviewInvite | null> {
  if (!isReviewToken(token)) return null;
  const supabase = createServiceClient();
  const { data: review } = await supabase
    .from("reviews")
    .select("id, status, rating, order_id")
    .eq("token", token)
    .maybeSingle();
  if (!review) return null;

  let orderNumber: string | null = null;
  let defaultName = "";
  let defaultRole = "";
  let items: string[] = [];
  if (review.order_id) {
    const [{ data: order }, { data: itemRows }] = await Promise.all([
      supabase.from("orders").select("order_number, customer").eq("id", review.order_id).maybeSingle(),
      supabase.from("order_items").select("wc_line_name, qty").eq("order_id", review.order_id).order("id"),
    ]);
    orderNumber = order?.order_number || null;
    const billing = (order?.customer as { billing?: { name?: string; company?: string; isCompany?: boolean } } | null)?.billing;
    defaultName = billing?.name?.trim() || "";
    defaultRole = billing?.company?.trim() || "";
    // Název položky bez konfigurace ("Nůžkový stan 3×3 — S potiskem · …").
    items = Array.from(
      new Set((itemRows || []).map((it) => String(it.wc_line_name || "").split(" — ")[0].trim()).filter(Boolean))
    );
  }

  return {
    id: review.id,
    status: review.status,
    rating: review.rating,
    orderNumber,
    defaultName,
    defaultRole,
    items,
  };
}

export type PublicReview = {
  id: string;
  rating: number;
  body: string;
  authorName: string;
  authorRole: string;
  photo: string | null;
};

// Na homepage jen recenze se souhlasem zákazníka, které admin zveřejnil.
export async function fetchPublishedReviews(): Promise<PublicReview[]> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("reviews")
      .select("id, rating, body, author_name, author_role, photos, cover_photo")
      .eq("published", true)
      .eq("allow_publish", true)
      .eq("status", "submitted")
      .order("submitted_at", { ascending: false })
      .limit(12);
    if (error || !data) return [];
    return data.map((r) => {
      const photos = (r.photos as string[] | null) || [];
      const cover = r.cover_photo && photos.includes(r.cover_photo) ? r.cover_photo : photos[0];
      return {
        id: r.id,
        rating: r.rating || 5,
        body: r.body || "",
        authorName: r.author_name || "Spokojený zákazník",
        authorRole: r.author_role || "",
        photo: cover ? reviewPhotoUrl(cover) : null,
      };
    });
  } catch {
    // Chybějící tabulka / env — homepage se vykreslí bez recenzí.
    return [];
  }
}
