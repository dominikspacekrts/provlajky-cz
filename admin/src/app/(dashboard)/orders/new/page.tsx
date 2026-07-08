import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Customer } from "@/lib/types";
import NewOrderForm from "./new-order-form";

export const dynamic = "force-dynamic";

export default async function NewOrderPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("orders").select("customer").order("created_at", { ascending: false }).limit(500);

  const seen = new Set<string>();
  const knownCustomers: Customer[] = [];
  for (const row of data || []) {
    const c = row.customer as Customer | null;
    const b = c?.billing;
    if (!b || (!b.company && !b.name)) continue;
    const key = `${b.company || ""}|${b.name || ""}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    knownCustomers.push(c);
  }
  knownCustomers.sort((a, b) => (a.billing.company || a.billing.name || "").localeCompare(b.billing.company || b.billing.name || ""));

  return (
    <div>
      <Link href="/orders" className="back">
        ← Zpět na objednávky
      </Link>
      <h2>Nová objednávka</h2>
      <NewOrderForm knownCustomers={knownCustomers} />
    </div>
  );
}
