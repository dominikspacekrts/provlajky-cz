import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import SiteChrome from "@/components/SiteChrome";
import { SITE_URL } from "@/lib/site";
import { getMarketingHeadSnippet } from "@/lib/marketing";

// Space Grotesk — technický, mírně atypický grotesk s proměnnou vahou (wght),
// nahrazuje původní příliš generický Archivo. Jeden font na celý web.
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-sans",
  display: "swap",
});

const DEFAULT_TITLE = "PROVLAJKY.CZ — reklamní vlajky, bannery, nafukovací reklama a stany na míru";
const DEFAULT_DESCRIPTION =
  "Reklamní vlajky, PVC bannery, nafukovací reklama a nůžkové stany na míru. Vyberete rozměr, nahrajete logo a hned vidíte cenu.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: DEFAULT_TITLE, template: "%s | PROVLAJKY.CZ" },
  description: DEFAULT_DESCRIPTION,
  openGraph: {
    type: "website",
    locale: "cs_CZ",
    siteName: "PROVLAJKY.CZ",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/hero/plazove-vlajky.jpg", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/hero/plazove-vlajky.jpg"],
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Konverzní/sledovací kódy z admin Nastavení → Marketing (Google Ads, Meta
  // Pixel, GA4…) — dokud nikdo nic nevloží, snippet je null a hlavička je
  // beze změny.
  const marketingSnippet = await getMarketingHeadSnippet();

  return (
    <html lang="cs" className={spaceGrotesk.variable}>
      {marketingSnippet && <head dangerouslySetInnerHTML={{ __html: marketingSnippet }} />}
      <body className="nv">
        <CartProvider>
          <SiteChrome>{children}</SiteChrome>
        </CartProvider>
      </body>
    </html>
  );
}
