"use client";

import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { DiscountPopupProvider } from "@/components/DiscountPopup";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  return (
    <DiscountPopupProvider>
      <Header />
      <main>{children}</main>
      <Footer />
    </DiscountPopupProvider>
  );
}
