import type { Metadata } from "next";
import { DM_Sans } from "next/font/google";
import "./globals.css";
import { CartProvider } from "@/lib/cart";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AppBackdrop from "@/components/AppBackdrop";

const dmSans = DM_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-dm-sans" });

export const metadata: Metadata = {
  title: "PROVLAJKY.CZ — plážové vlajky, bannery a reklamní stojany",
  description: "Plážové vlajky, vlajky na zakázku, PVC bannery a příslušenství na míru pro vaši značku.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs" className={dmSans.variable}>
      <body>
        <CartProvider>
          <AppBackdrop />
          <Header />
          {children}
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
