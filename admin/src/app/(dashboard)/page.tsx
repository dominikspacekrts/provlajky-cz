import Link from "next/link";
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

  const tiles = [
    {
      href: "/orders",
      icon: "📦",
      title: "Objednávky",
      sub: `${orderCount ?? 0} objednávek`,
    },
    {
      href: "/platby",
      icon: "💸",
      title: "Platby",
      sub: "Výdělky a výplaty partnerů",
    },
    {
      href: "/faktury",
      icon: "🧾",
      title: "Faktury",
      sub: `${unpaidCount ?? 0} nezaplacených`,
    },
    {
      href: "/uzivatele",
      icon: "👥",
      title: "Uživatelé",
      sub: `${customerCount ?? 0} registrovaných`,
    },
    {
      href: "/settings",
      icon: "⚙️",
      title: "Nastavení",
      sub: "Firma, SMTP, partneři, šablony",
    },
    {
      href: "/statistika",
      icon: "📊",
      title: "Statistika",
      sub: "Tržby, náklady, zisk",
    },
    {
      href: "/products",
      icon: "🏳️",
      title: "Produkty",
      sub: `${productCount ?? 0} produktů, ${activeProductCount ?? 0} aktivních na eshopu`,
    },
    {
      href: "/email-history",
      icon: "✉️",
      title: "Historie mailů",
      sub: "Odeslané e-maily s náhledem",
    },
    {
      href: "/migrate",
      icon: "📥",
      title: "Migrace",
      sub: "Import dat ze staré appky",
    },
  ];

  return (
    <div>
      <h2>Domů</h2>
      <div className="home-tiles">
        {tiles.map((t) => (
          <Link key={t.href} href={t.href} className="home-tile">
            <span className="tile-icon">{t.icon}</span>
            <span className="tile-title">{t.title}</span>
            <span className="tile-sub">{t.sub}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
