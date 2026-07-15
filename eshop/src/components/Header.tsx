"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { PRODUCT_CATEGORIES } from "@/lib/types";

const NAV: [string, string][] = [
  ...Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => [`/${slug}`, label] as [string, string]),
  ["/stany", "Nůžkové stany"],
];

export default function Header() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();

  // Homepage je bez lišty — jen plovoucí košík vpravo nahoře.
  if (pathname === "/") {
    return (
      <Link href="/kosik" className="cart-pill floating">
        Košík
        {count > 0 && <span className="cart-count">{count}</span>}
      </Link>
    );
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo" aria-label="PROVLAJKY.CZ — domů">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" style={{ height: 30, width: "auto", display: "block" }} />
        </Link>
        <nav className="site-nav">
          {NAV.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
        </nav>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Link href="/kosik" className="cart-pill">
            Košík
            {count > 0 && <span className="cart-count">{count}</span>}
          </Link>
          <button className="burger" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
            ☰
          </button>
        </div>
      </div>
      {menuOpen && (
        <div className="container" style={{ paddingBottom: 16, display: "flex", flexDirection: "column", gap: 12 }}>
          {NAV.map(([href, label]) => (
            <Link key={href} href={href} onClick={() => setMenuOpen(false)} style={{ fontWeight: 600 }}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
