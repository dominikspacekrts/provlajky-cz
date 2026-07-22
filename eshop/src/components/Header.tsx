"use client";

// Chrome je na celém webu stejné: na homepage jen plovoucí košík, jinde navíc
// domeček zpátky na úvod — mění se pouze obsah stránky, ne rozhraní kolem něj.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/lib/cart";

function HomeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 11.5L12 4l8 7.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Header() {
  const { count } = useCart();
  const pathname = usePathname();

  const cart = (
    <Link href="/kosik" className="cart-pill">
      Košík
      {count > 0 && <span className="cart-count">{count}</span>}
    </Link>
  );

  // /nova má vlastní hlavičku (logo + košík), globální chrome tu neukazujeme.
  if (pathname === "/nova") return null;

  if (pathname === "/") {
    return <div className="floating-controls floating-right">{cart}</div>;
  }

  return (
    <>
      <div className="floating-controls floating-left">
        <Link href="/" className="home-btn" aria-label="Zpět na úvod">
          <HomeIcon />
        </Link>
      </div>
      <div className="floating-controls floating-right">{cart}</div>
    </>
  );
}
