"use client";

// Jedno pevné pozadí (fixed) pro celý web kromě homepage — zůstává na místě při
// klientské navigaci mezi stránkami, takže se při proklikávání mění jen obsah nahoře.

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getLastHeroPhoto, HERO_PHOTOS } from "@/lib/heroPhoto";

export default function AppBackdrop() {
  const pathname = usePathname();
  const [photo, setPhoto] = useState<string | null>(null);

  useEffect(() => {
    // Znovu načíst při každé změně cesty — dokud jsme na "/", slideshow průběžně
    // aktualizuje sessionStorage, takže při odchodu z homepage chceme vždy tu
    // fotku, co je zrovna aktivní, ne tu, co byla při prvním načtení stránky.
    if (pathname !== "/" && pathname !== "/nova") {
      setPhoto(getLastHeroPhoto() ?? HERO_PHOTOS[0]);
    }
  }, [pathname]);

  // /nova má vlastní hero pozadí — pevné celoobrazovkové pozadí tu nechceme.
  if (pathname === "/" || pathname === "/nova" || !photo) return null;

  return (
    <div className="app-backdrop" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={photo} alt="" />
      <div className="app-backdrop-shade" />
    </div>
  );
}
