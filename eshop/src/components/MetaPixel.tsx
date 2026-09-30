"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { subscribeConsent } from "@/lib/consent";
import { activateMetaPixel, metaPixelEnabled, trackMeta } from "@/lib/meta-pixel";

// Head skript stihne PageView jen při prvním načtení, a jen když souhlas
// už v cookie je. Tady se pixel zapne, když souhlas přijde až z lišty,
// a PageView se zopakuje při přechodu mezi stránkami (App Router je SPA).
export default function MetaPixel() {
  const pathname = usePathname();
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!metaPixelEnabled()) return;

    function onPage() {
      const wasBooted = !!window.__metaPixelBooted;
      if (!activateMetaPixel()) return;
      if (trackedPath.current === pathname) return;
      if (trackedPath.current === null && wasBooted) {
        trackedPath.current = pathname;
        return;
      }
      trackedPath.current = pathname;
      trackMeta("PageView");
    }

    onPage();
    return subscribeConsent(onPage);
  }, [pathname]);

  return null;
}
