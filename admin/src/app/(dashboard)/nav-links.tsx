"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Domů" },
  { href: "/orders", label: "Objednávky" },
  { href: "/finance", label: "Finance" },
  { href: "/email-history", label: "Historie mailů" },
  { href: "/settings", label: "Nastavení" },
  { href: "/migrate", label: "Migrace" },
];

export default function NavLinks() {
  const pathname = usePathname();
  return (
    <>
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-link${active ? " active" : ""}`}>
            {l.label}
          </Link>
        );
      })}
    </>
  );
}
