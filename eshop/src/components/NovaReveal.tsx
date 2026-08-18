"use client";

// Sdílené odkrývání při scrollu pro /nova. Vrací ref a příznak "už je vidět";
// CSS pak jen přidá animaci. Výchozí stav prvku je VŽDY viditelný — když
// observer nikdy nedoběhne (starý prohlížeč, vypnutý JS, throttling), obsah
// zůstane na stránce, jen se neodanimuje.

import { useEffect, useRef, useState } from "react";

export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.14) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return { ref, inView };
}

/** Šipka v jednotném tahu — používá se v tlačítkách i v popiskách polí. */
export function NovaArrow({ className = "nv-arrow" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        d="M4.5 12h14M12.5 5.8l6.2 6.2-6.2 6.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
