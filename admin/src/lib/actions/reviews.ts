"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { createClient, createServiceClient } from "@/lib/supabase/server";

// Recenze zákazníků (2026-09-reviews.sql). Pozvánku vytváří admin u
// objednávky, vyplňuje ji zákazník na eshopu (/hodnoceni/<token>), zveřejňuje
// ji zase admin v sekci Recenze.

const PHOTO_BUCKET = "review-photos";

// Stejné pořadí zdrojů jako u odkazů na nastavení hesla (lib/actions/customers.ts).
function eshopBaseUrl(): string {
  const raw = process.env.ESHOP_URL || process.env.NEXT_PUBLIC_ESHOP_URL || "https://provlajky.cz";
  return raw.replace(/\/$/, "");
}

// Server akce vrací chybu jako hodnotu, ne výjimkou — Next.js na produkci
// text vyhozené chyby schová a admin by viděl jen obecné „An error occurred
// in the Server Components render“.
export type ReviewActionResult = { ok: true } | { ok: false; error: string };

function dbError(error: { code?: string; message: string }): string {
  // 42P01 = Postgres, PGRST205 = PostgREST (tabulka není ve schema cache).
  return error.code === "42P01" || error.code === "PGRST205"
    ? "Tabulka recenzí ještě neexistuje — spusť v Supabase migraci 2026-09-reviews.sql."
    : error.message;
}

async function guard(fn: () => Promise<void>): Promise<ReviewActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Akce se nepovedla." };
  }
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Nepřihlášený uživatel.");
  return supabase;
}

export type ReviewInvite = { ok: true; link: string; status: "invited" | "submitted" } | { ok: false; error: string };

// Jedna pozvánka na objednávku — opakované odeslání pošle stejný odkaz, takže
// zákazník nemůže mít v poště dva různé a vyplnit dvakrát.
export async function getOrCreateReviewInvite(orderId: string): Promise<ReviewInvite> {
  try {
    return await createInvite(orderId);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Pozvánku se nepodařilo vytvořit." };
  }
}

async function createInvite(orderId: string): Promise<ReviewInvite> {
  const supabase = await requireUser();
  const { data: existing, error: readError } = await supabase
    .from("reviews")
    .select("token, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (readError) throw new Error(dbError(readError));
  if (existing) {
    return { ok: true, link: `${eshopBaseUrl()}/hodnoceni/${existing.token}`, status: existing.status };
  }

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("reviews").insert({ order_id: orderId, token });
  if (error) throw new Error(dbError(error));
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/recenze");
  return { ok: true, link: `${eshopBaseUrl()}/hodnoceni/${token}`, status: "invited" };
}

export async function setReviewPublished(id: string, published: boolean): Promise<ReviewActionResult> {
  return guard(async () => {
    const supabase = await requireUser();
    if (published) {
      // Bez souhlasu zákazníka se zveřejnit nesmí — hlídá se i tady, ne jen
      // zašedlým přepínačem v UI.
      const { data } = await supabase.from("reviews").select("allow_publish, status").eq("id", id).single();
      if (!data?.allow_publish || data.status !== "submitted") {
        throw new Error("Zákazník nedal souhlas se zveřejněním.");
      }
    }
    const { error } = await supabase.from("reviews").update({ published }).eq("id", id);
    if (error) throw new Error(dbError(error));
    revalidatePath("/recenze");
  });
}

export async function setReviewCover(id: string, path: string | null): Promise<ReviewActionResult> {
  return guard(async () => {
    const supabase = await requireUser();
    const { error } = await supabase.from("reviews").update({ cover_photo: path }).eq("id", id);
    if (error) throw new Error(dbError(error));
    revalidatePath("/recenze");
  });
}

// Podpis a firmu smí admin opravit (překlep, velká písmena); text a hvězdičky
// zůstávají přesně tak, jak je zákazník napsal.
export async function updateReviewAuthor(id: string, fields: { author_name: string; author_role: string }): Promise<ReviewActionResult> {
  return guard(async () => {
    const supabase = await requireUser();
    const { error } = await supabase
      .from("reviews")
      .update({ author_name: fields.author_name.trim() || null, author_role: fields.author_role.trim() || null })
      .eq("id", id);
    if (error) throw new Error(dbError(error));
    revalidatePath("/recenze");
  });
}

export async function deleteReview(id: string): Promise<ReviewActionResult> {
  return guard(async () => {
    const supabase = await requireUser();
    const { data } = await supabase.from("reviews").select("photos, order_id").eq("id", id).single();
    const photos = (data?.photos as string[] | undefined) || [];
    if (photos.length) {
      // Storage nemá RLS pro allowed_users — maže service klient, přihlášení
      // ověřil requireUser výš.
      const { error: storageError } = await createServiceClient().storage.from(PHOTO_BUCKET).remove(photos);
      if (storageError) console.error("deleteReview: storage remove failed", storageError);
    }
    const { error } = await supabase.from("reviews").delete().eq("id", id);
    if (error) throw new Error(dbError(error));
    revalidatePath("/recenze");
    if (data?.order_id) revalidatePath(`/orders/${data.order_id}`);
  });
}
