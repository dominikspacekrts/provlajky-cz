"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/orders", icon: "📦", label: "Objednávky" },
  { href: "/platby", icon: "💸", label: "Platby" },
  { href: "/faktury", icon: "🧾", label: "Faktury" },
  { href: "/uzivatele", icon: "👥", label: "Uživatelé" },
  { href: "/settings", icon: "⚙️", label: "Nastavení" },
  { href: "/statistika", icon: "📊", label: "Statistika" },
  { href: "/products", icon: "🏳️", label: "Produkty" },
  { href: "/konfigurace-webu", icon: "🖼️", label: "Konfigurace webu" },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="app-sidebar" aria-label="Hlavní navigace">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link key={item.href} href={item.href} className={active ? "active" : undefined}>
            <span className="icon">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
