import { createClient } from "@/lib/supabase/server";
import type { Review } from "@/lib/types";
import ReviewsList, { type ReviewRow } from "./reviews-list";

export const dynamic = "force-dynamic";

export default async function RecenzePage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("reviews")
    .select("*, orders(order_number, customer)")
    .order("submitted_at", { ascending: false, nullsFirst: false })
    .order("invited_at", { ascending: false });

  const rows: ReviewRow[] = ((data || []) as (Review & { orders: ReviewRow["order"] })[]).map(({ orders, ...r }) => ({
    ...r,
    order: orders,
  }));

  return (
    <div>
      <h2>Recenze</h2>
      <p className="muted">
        Hodnocení od zákazníků. Odkaz na dotazník pošleš u objednávky tlačítkem <strong>Odeslat hodnocení</strong>.
        Na homepage eshopu se ukážou jen zveřejněné recenze — a zveřejnit jde jen tu, u které zákazník dal souhlas.
      </p>
      {error ? (
        <p className="muted" style={{ color: "#dc2626" }}>
          Tabulka recenzí ještě neexistuje — spusť prosím migraci <code>2026-09-reviews.sql</code> v Supabase SQL editoru.
        </p>
      ) : (
        <ReviewsList rows={rows} />
      )}
    </div>
  );
}
