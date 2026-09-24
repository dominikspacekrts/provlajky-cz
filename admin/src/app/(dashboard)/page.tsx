import Link from "next/link";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const [
    { count: orderCount },
    { count: unpaidCount },
    { count: productCount },
    { count: activeProductCount },
    { count: customerCount },
  ] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("paid", false),
    supabase.from("products").select("id", { count: "exact", head: true }),
    supabase.from("products").select("id", { count: "exact", head: true }).eq("active", true),
    supabase.from("customers").select("id", { count: "exact", head: true }),
  ]);

  const subOverrides: Record<string, string> = {
    "/orders": `${orderCount ?? 0} objednávek`,
    "/faktury": `${unpaidCount ?? 0} nezaplacených`,
    "/uzivatele": `${customerCount ?? 0} registrovaných`,
    "/products": `${productCount ?? 0} produktů, ${activeProductCount ?? 0} aktivních na eshopu`,
  };

  const tiles = ADMIN_NAV.map((item) => ({
    ...item,
    sub: subOverrides[item.href] ?? item.sub,
  }));

  return (
    <div>
      <h2>Domů</h2>
      <div className="home-tiles">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="home-tile">
            <span className="tile-icon">{t.icon}</span>
            <span className="tile-title">{t.label}</span>
            <span className="tile-sub">{t.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
