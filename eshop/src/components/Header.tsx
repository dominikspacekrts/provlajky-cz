"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart";
import { PRODUCT_CATEGORIES } from "@/lib/types";

export default function Header() {
  const { count } = useCart();
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          PROVLAJKY<span className="dot">.CZ</span>
        </Link>
        <nav className="site-nav">
          {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
            <Link key={slug} href={`/${slug}`}>
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
          {Object.entries(PRODUCT_CATEGORIES).map(([slug, label]) => (
            <Link key={slug} href={`/${slug}`} onClick={() => setMenuOpen(false)} style={{ fontWeight: 600 }}>
              {label}
            </Link>
          ))}
        </div>
      )}
    </header>
  );
}
