import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import SiteChrome from "@/components/SiteChrome";

// Space Grotesk — technický, mírně atypický grotesk s proměnnou vahou (wght),
// nahrazuje původní příliš generický Archivo. Jeden font na celý web.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
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
    <html lang="cs" className={spaceGrotesk.variable}>
      <body className="nv">
        <CartProvider>
          <SiteChrome>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
