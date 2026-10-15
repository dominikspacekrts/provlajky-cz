"use server";

import { createClient } from "@/lib/supabase/server";

/** Tělo mailu se nenačítá do seznamu historie — jen při otevření náhledu. */
export async function getEmailHistoryHtml(id: string): Promise<string | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("email_history").select("html_body").eq("id", id).maybeSingle();
  if (error) throw new Error(error.message);
  return data?.html_body ?? null;
}
