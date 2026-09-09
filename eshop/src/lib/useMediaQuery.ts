"use client";

// Sleduje CSS media query z JS. Na serveru i při prvním renderu vrací false,
// takže se markup shoduje a teprve efekt po připojení dorovná skutečný stav —
// komponenty, které se podle toho vykreslují jinak, tedy nesmí na první render
// spoléhat (mobilní varianta naskočí až po připojení).

import { useEffect, useState } from "react";

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}
