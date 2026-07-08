import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const [{ count: orderCount }, { count: unpaidCount }] = await Promise.all([
    supabase.from("orders").select("id", { count: "exact", head: true }),
    supabase.from("invoices").select("id", { count: "exact", head: true }).eq("paid", false),
  ]);

  const tiles = [
    {
      href: "/orders",
      icon: "📦",
      title: "Objednávky",
      sub: `${orderCount ?? 0} objednávek`,
    },
    {
      href: "/finance",
      icon: "💶",
      title: "Finance",
      sub: `${unpaidCount ?? 0} nezaplacených faktur`,
    },
    {
      href: "/email-history",
      icon: "✉️",
      title: "Historie mailů",
      sub: "Odeslané e-maily s náhledem",
    },
    {
      href: "/settings",
      icon: "⚙️",
      title: "Nastavení",
      sub: "Firma, SMTP, partneři, šablony",
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
