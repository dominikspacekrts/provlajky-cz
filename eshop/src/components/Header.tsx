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
import { NAV_GROUPS } from "@/lib/types";

const PROMO_DISMISSED_KEY = "provlajky-promo-dismissed";

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();
  const [stuck, setStuck] = useState(false);
  // Výchozí true (skrytý), dokud efekt neověří sessionStorage — na serveru
  // ani při prvním renderu na klientu nevíme, jestli uživatel pruh už
  // zavřel, takže ho ukážeme až po zjištění stavu (žádné bliknutí).
  const [promoDismissed, setPromoDismissed] = useState(true);

  useEffect(() => {
    const onScroll = () => setStuck(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time read of dismissal state on mount
      setPromoDismissed(sessionStorage.getItem(PROMO_DISMISSED_KEY) === "1");
    } catch {
      setPromoDismissed(false);
    }
  }, []);

  function dismissPromo() {
    setPromoDismissed(true);
    try {
      sessionStorage.setItem(PROMO_DISMISSED_KEY, "1");
    } catch {
      // soukromé prohlížení / zakázaný storage — pruh zmizí jen pro tuhle stránku
    }
  }

  const isHome = pathname === "/";

  return (
    <>
      {SALE.active && !promoDismissed && (
        <div className="nv-promo">
          <Link href={SALE.href} className="nv-promo-l">
            <b>Letní akce</b>
            <span>
              Sleva {SALE.percent} % na {SALE.what} — do {SALE.until}.
            </span>
            <NovaArrow />
          </Link>
          <button
            type="button"
            className="nv-promo-close"
            onClick={dismissPromo}
            aria-label="Zavřít nabídku letní akce"
          >
            ×
          </button>
        </div>
      )}

      <header className={`nv-nav${stuck ? " is-stuck" : ""}`}>
        <div className="nv-nav-left">
          <Link href="/" className="nv-logo" aria-label="PROVLAJKY.CZ — úvodní strana">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo/logo-bile.png" alt="PROVLAJKY.CZ" />
          </Link>
          <nav className="nv-nav-groups" aria-label="Kategorie produktů">
            {NAV_GROUPS.map((g) => (
              <Link key={g.id} href={g.href}>
                {g.label}
              </Link>
            ))}
          </nav>
        </div>
        <div className="nv-nav-right">
          <a href={isHome ? "#registrace" : "/#registrace"} className="nv-btn nv-btn-yellow">
            <span className="nv-btn-l">Registrace · sleva 10 %</span>
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
