"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { subscribeConsent } from "@/lib/consent";
import { metaPixelEnabled, syncMetaConsent, trackMeta } from "@/lib/meta-pixel";

// Základní kód + první PageView jsou v <head>. Tady se po souhlasu z lišty
// udělá grant (a PageView, pokud head ještě neměl souhlas) a při SPA
// navigaci se PageView zopakuje.
export default function MetaPixel() {
  const pathname = usePathname();
  // null = ještě neběžel efekt; false/true = poslední známý marketingový souhlas
  const hadConsent = useRef<boolean | null>(null);
  const trackedPath = useRef<string | null>(null);

  useEffect(() => {
    if (!metaPixelEnabled()) return;

    function onPage() {
      const allowed = syncMetaConsent();
      if (!allowed) {
        hadConsent.current = false;
        trackedPath.current = null;
        return;
      }

      const prev = hadConsent.current;
      hadConsent.current = true;
      const justGranted = prev === false;

      if (trackedPath.current === pathname && !justGranted) return;

      // Head už PageView poslal, když souhlas byl v cookie při načtení.
      if (trackedPath.current === null && prev === null && window.__metaPixelBooted && !justGranted) {
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
