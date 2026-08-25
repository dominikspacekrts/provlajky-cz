"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type OrderCounter = { year: number; next_val: number };

// order_counters existuje až po migraci 2026-08-order-numbering.sql (trigger,
// co přiděluje číslo objednávky) — dokud neproběhla, vrátíme null a
// nastavení to zobrazí jako "zatím nedostupné", ne jako chybu.
export async function getOrderCounter(): Promise<OrderCounter | null> {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  try {
    const { data, error } = await supabase.from("order_counters").select("*").eq("year", year).maybeSingle();
    if (error) return null;
    return (data as OrderCounter) || { year, next_val: 1 };
  } catch {
    return null;
  }
}

// Nastaví číslo, kterým se očísluje PŘÍŠTÍ založená objednávka (rok se bere
// vždy aktuální — formát čísla je RRRRNNNN, viz next_order_number() v DB).
export async function setOrderCounter(nextVal: number) {
  const supabase = await createClient();
  const year = new Date().getFullYear();
  const { error } = await supabase.from("order_counters").upsert({ year, next_val: nextVal }, { onConflict: "year" });
  if (error) throw new Error(error.message);
  revalidatePath("/settings");
}
