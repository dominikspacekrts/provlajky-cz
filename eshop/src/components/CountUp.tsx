"use client";

// Počítadlo: při načtení odanimuje číslo od 0 do cílové hodnoty (výchozí ~1s, easeOut).

import { useEffect, useState } from "react";

export default function CountUp({
  target,
  suffix = "+",
  duration = 1000,
}: {
  target: number;
  suffix?: string;
  duration?: number;
}) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setValue(Math.round(eased * target));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return (
    <div className="num">
      {value.toLocaleString("cs-CZ")}
      {suffix}
    </div>
  );
}
