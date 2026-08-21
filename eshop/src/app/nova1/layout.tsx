import type { Metadata } from "next";
import { Big_Shoulders_Stencil, Inter } from "next/font/google";
import "./nova1.css";

// Stencil display face: physical flag/crate/signage lettering is cut from
// a stencil, not set from a grotesque type family — this world is built
// from that fact, not from Archivo shared with the rest of the site.
const stencil = Big_Shoulders_Stencil({
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800", "900"],
  variable: "--font-signal-display",
  display: "swap",
});

const body = Inter({
  subsets: ["latin", "latin-ext"],
  variable: "--font-signal-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROVLAJKY.CZ — signální řada (koncept)",
  description:
    "Reklamní vlajky, bannery, nafukovací reklama a nůžkové stany na míru. Koncept nové domovské stránky.",
};

export default function Nova1Layout({ children }: { children: React.ReactNode }) {
  return <div className={`n1 ${stencil.variable} ${body.variable}`}>{children}</div>;
}
