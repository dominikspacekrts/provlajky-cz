"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";

export async function updatePartner(id: string, fields: Partial<Pick<Partner, "name" | "share" | "billing">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("partners").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/platby");
}

// partners.id je text (ne uuid) — starý app měl ruční id jako "alex"/"dominik"
// a odkazují se na něj payouts.partner_id, takže u nových partnerů uděláme
// stejné čitelné id ze jména.
function slugifyPartnerId(name: string) {
  const base = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `partner-${Date.now()}`;
}

export async function createPartner(name: string) {
  const supabase = await createClient();
  const id = slugifyPartnerId(name);
  const { error } = await supabase.from("partners").insert({ id, name, share: 0, billing: {} });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/platby");
}

// payouts.partner_id odkazuje na partners(id) bez on delete cascade — pokud
// má partner už nějaké výplaty, smazání spadne na chybě z DB (schválně,
// ať se neztratí historie výplat).
export async function deletePartner(id: string) {
  const supabase = await createClient();
  const { error } = await supabase.from("partners").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/platby");
}
