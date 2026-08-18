"use client";

// Chrome celého webu: pruh s akcí úplně nahoře (odscrolluje pryč) a pod ním
// černá lišta, která zůstává u horní hrany a při scrollu se stáhne.
// Na homepage leží lišta nad hero fotkou, na podstránkách nad papírovým
// podkladem — proto má vždycky plnou tmavou výplň, ne průhlednou.

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";
import { SALE } from "@/lib/sale";
import { NovaArrow } from "@/components/NovaReveal";

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const isHome = pathname === "/";

  return (
    <>
      {SALE.active && (
        <Link href={SALE.href} className="nv-promo">
          <span className="nv-promo-l">
            <b>Letní akce</b>
            <span>
              Sleva {SALE.percent} % na {SALE.what} — do {SALE.until}.
            </span>
            <NovaArrow />
          </span>
        </Link>
      )}

      <header className={`nv-nav${stuck ? " is-stuck" : ""}`}>
        <Link href="/" className="nv-logo" aria-label="PROVLAJKY.CZ — úvodní strana">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo/logo-bile.png" alt="PROVLAJKY.CZ" />
        </Link>
        <div className="nv-nav-right">
          <a href={isHome ? "#produkty" : "/#produkty"} className="nv-btn nv-btn-yellow">
            <span className="nv-btn-l">Vyberte si svůj produkt</span>
          </a>
          <Link href="/kosik" className="nv-nav-cart">
            <span className="nv-btn-l">
              Košík
              {count > 0 && <em className="nv-nav-count">{count}</em>}
            </span>
          </Link>
        </div>
      </header>
    </>
  );
}
