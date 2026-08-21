import type { Metadata } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import SiteChrome from "@/components/SiteChrome";

// Archivo má proměnnou osu šířky (wdth) — rozšířený řez nese titulky,
// úzký drobné popisky u trati. Jeden font na celý web.
const archivo = Archivo({
  subsets: ["latin", "latin-ext"],
  axes: ["wdth"],
  variable: "--font-archivo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROVLAJKY.CZ — reklamní vlajky, bannery, nafukovací reklama a stany na míru",
  description:
    "Reklamní vlajky, PVC bannery, nafukovací reklama a nůžkové stany na míru. Vyberete rozměr, nahrajete logo a hned vidíte cenu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={archivo.variable}>
      <body className="nv">
        <CartProvider>
          <SiteChrome>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
