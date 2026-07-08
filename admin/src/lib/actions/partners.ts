"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Partner } from "@/lib/types";

export async function updatePartner(id: string, fields: Partial<Pick<Partner, "name" | "share" | "billing">>) {
  const supabase = await createClient();
  const { error } = await supabase.from("partners").update(fields).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
  revalidatePath("/finance");
}
