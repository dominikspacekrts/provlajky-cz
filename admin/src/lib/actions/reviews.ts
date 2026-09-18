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

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Nepřihlášený uživatel.");
  return supabase;
}

export type ReviewInvite = { link: string; status: "invited" | "submitted" };

// Jedna pozvánka na objednávku — opakované odeslání pošle stejný odkaz, takže
// zákazník nemůže mít v poště dva různé a vyplnit dvakrát.
export async function getOrCreateReviewInvite(orderId: string): Promise<ReviewInvite> {
  const supabase = await requireUser();
  const { data: existing, error: readError } = await supabase
    .from("reviews")
    .select("token, status")
    .eq("order_id", orderId)
    .maybeSingle();
  if (readError) {
    throw new Error(
      readError.code === "42P01"
        ? "Tabulka recenzí ještě neexistuje — spusť migraci 2026-09-reviews.sql."
        : readError.message
    );
  }
  if (existing) {
    return { link: `${eshopBaseUrl()}/hodnoceni/${existing.token}`, status: existing.status };
  }

  const token = randomBytes(24).toString("base64url");
  const { error } = await supabase.from("reviews").insert({ order_id: orderId, token });
  if (error) throw new Error(error.message);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/recenze");
  return { link: `${eshopBaseUrl()}/hodnoceni/${token}`, status: "invited" };
}

export async function setReviewPublished(id: string, published: boolean) {
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
  if (error) throw new Error(error.message);
  revalidatePath("/recenze");
}

export async function setReviewCover(id: string, path: string | null) {
  const supabase = await requireUser();
  const { error } = await supabase.from("reviews").update({ cover_photo: path }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recenze");
}

// Podpis a firmu smí admin opravit (překlep, velká písmena); text a hvězdičky
// zůstávají přesně tak, jak je zákazník napsal.
export async function updateReviewAuthor(id: string, fields: { author_name: string; author_role: string }) {
  const supabase = await requireUser();
  const { error } = await supabase
    .from("reviews")
    .update({ author_name: fields.author_name.trim() || null, author_role: fields.author_role.trim() || null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/recenze");
}

export async function deleteReview(id: string) {
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
  if (error) throw new Error(error.message);
  revalidatePath("/recenze");
  if (data?.order_id) revalidatePath(`/orders/${data.order_id}`);
}
