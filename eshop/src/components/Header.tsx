"use client";

// Chrome celého webu: pruh s akcí úplně nahoře (odscrolluje pryč) a pod ním
// černá lišta, která zůstává u horní hrany a při scrollu se stáhne.
// Na homepage leží lišta nad hero fotkou, na podstránkách nad papírovým
// podkladem — proto má vždycky plnou tmavou výplň, ne průhlednou.
//
// Kategorie jsou v liště vypsané jen do 1280 px. Pod tím je nese vysouvací
// panel pod tlačítkem "Menu" — do té doby na mobilu žádná cesta do kategorií
// nevedla.

import { useEffect, useRef, useState } from "react";
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
  const [menuOpen, setMenuOpen] = useState(false);
  const promoRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

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

  // Skutečná výška promo pruhu jako CSS proměnná — konfigurátor (.fc-page)
  // z ní počítá, kolik místa nahoře doopravdy zbývá, ať se vejde na obrazovku
  // celý bez scrollu. 0, když je pruh pryč/skrytý/žádná akce neběží.
  useEffect(() => {
    const setVar = () => {
      const h = !promoDismissed && promoRef.current ? promoRef.current.getBoundingClientRect().height : 0;
      document.documentElement.style.setProperty("--nv-promo-h", `${h}px`);
    };
    setVar();
    window.addEventListener("resize", setVar);
    return () => window.removeEventListener("resize", setVar);
  }, [promoDismissed]);

  // Panel se zavře přechodem na jinou stránku — jinak by zůstal otevřený
  // nad novým obsahem.
  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuOpen(false);
        return;
      }
      // Tabulátor kroužíme uvnitř panelu — za ním leží zamrzlá stránka.
      if (e.key !== "Tab" || !menuRef.current) return;
      const focusables = menuRef.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])");
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    // Fokus do panelu, ať klávesnice nezůstane za ním na stránce.
    menuRef.current?.querySelector<HTMLElement>("a, button")?.focus();
    return () => {
      document.body.style.overflow = overflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function closeMenu() {
    setMenuOpen(false);
    menuButtonRef.current?.focus();
  }

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
        <div className="nv-promo" ref={promoRef}>
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
            <span className="nv-btn-l">Registrace</span>
          </a>
          <Link href="/kosik" className="nv-nav-cart">
            <span className="nv-btn-l">
              Košík
              {count > 0 && <em className="nv-nav-count">{count}</em>}
            </span>
          </Link>
          <button
            type="button"
            ref={menuButtonRef}
            className="nv-nav-burger"
            onClick={() => setMenuOpen(true)}
            aria-expanded={menuOpen}
            aria-controls="nv-menu"
            aria-label="Otevřít menu"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
              <path d="M3.5 7h17M3.5 12h17M3.5 17h17" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </header>

      {/* Vysouvací menu pro úzké displeje — kategorie, registrace, telefon. */}
      <div className={`nv-menu-root${menuOpen ? " is-open" : ""}`} aria-hidden={menuOpen ? undefined : true}>
        <button type="button" className="nv-menu-backdrop" onClick={closeMenu} tabIndex={-1} aria-hidden="true" />
        <div
          id="nv-menu"
          ref={menuRef}
          className="nv-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          inert={!menuOpen}
        >
          <div className="nv-menu-top">
            <span className="nv-menu-label">Kategorie</span>
            <button type="button" className="nv-menu-close" onClick={closeMenu} aria-label="Zavřít menu">
              <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="nv-menu-groups" aria-label="Kategorie produktů">
            {NAV_GROUPS.map((g) => (
              <Link key={g.id} href={g.href} className={pathname === g.href ? "is-current" : undefined}>
                <span>{g.label}</span>
                <NovaArrow />
              </Link>
            ))}
          </nav>

          <div className="nv-menu-foot">
            <a href={isHome ? "#registrace" : "/#registrace"} className="nv-btn nv-btn-yellow" onClick={closeMenu}>
              <span className="nv-btn-l">Registrace a sleva 10 %</span>
            </a>
            <div className="nv-menu-links">
              <Link href="/kontakt">Kontakt</Link>
              <Link href="/kosik">Košík{count > 0 ? ` (${count})` : ""}</Link>
            </div>
            <a href="tel:+420605981155" className="nv-menu-phone">
              +420 605 981 155
            </a>
          </div>
        </div>
      </div>
    </>
  );
}
