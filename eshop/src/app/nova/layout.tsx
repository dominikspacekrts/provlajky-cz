import type { Metadata } from "next";
import { Archivo } from "next/font/google";

// /nova má vlastní hlas: Archivo s proměnnou osou šířky (wdth) — rozšířený řez
// na titulky, úzký na drobné popisky. Font je načtený jen pro tuhle routu,
// zbytek webu dál běží na DM Sans.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROVLAJKY.CZ — reklamní vlajky, bannery, nafukovací reklama a stany na míru",
  description:
    "Reklamní vlajky, PVC bannery, nafukovací reklama a nůžkové stany na míru. Vyberete rozměr, nahrajete logo a hned vidíte cenu. Do 30. 9. 2026 sleva 10 % na plážové vlajky.",
};

export default function NovaLayout({ children }: { children: React.ReactNode }) {
  return <div className={archivo.variable}>{children}</div>;
}
