"use client";

// /nova1 carries its own header/footer in a different visual world (signal
// flags, not paddock signage) — it renders bare here so it can supply its
// own chrome instead of inheriting the black/yellow nav and footer.

import { usePathname } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function SiteChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const bare = pathname?.startsWith("/nova1") ?? false;

  if (bare) return <>{children}</>;

  return (
    <>
      <Header />
      <main>{children}</main>
      <Footer />
    </>
  );
}
