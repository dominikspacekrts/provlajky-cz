"use client";

// Společný layout konfigurátorů (vlajky, bannery, stany…): media query pro
// mobilní kroky a měření výšky .fc-page, ať spodní CtaBar sedí ve viewportu
// i když nad ním roste promo pruh / navigace.

import { useEffect, useRef } from "react";
import { useMediaQuery } from "@/lib/useMediaQuery";

export const CONFIGURATOR_MOBILE_MQ = "(max-width: 860px)";

export function useConfiguratorLayout() {
  const isMobile = useMediaQuery(CONFIGURATOR_MOBILE_MQ);
  const pageRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = pageRef.current;
    if (!el) return;
    if (!isMobile) {
      el.style.removeProperty("height");
      el.style.removeProperty("--fc-stage-h");
      return;
    }
    const fit = () => {
      if (window.scrollY > 4) return;
      const top = el.getBoundingClientRect().top;
      const next = Math.max(480, Math.round(window.innerHeight - top - 8));
      if (Math.abs(parseFloat(el.style.height || "0") - next) > 1) el.style.height = `${next}px`;
      const stage = el.querySelector<HTMLElement>(".fc-stage");
      if (stage) el.style.setProperty("--fc-stage-h", `${Math.round(stage.getBoundingClientRect().height)}px`);
    };
    fit();
    const raf = requestAnimationFrame(fit);
    const timers = [80, 300, 900, 1800].map((ms) => window.setTimeout(fit, ms));
    const ro = new ResizeObserver(fit);
    ro.observe(document.body);
    for (const sel of [".nv-nav", ".nv-promo"]) {
      const bar = document.querySelector(sel);
      if (bar) ro.observe(bar);
    }
    window.addEventListener("resize", fit);
    window.addEventListener("orientationchange", fit);
    window.addEventListener("load", fit);
    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(window.clearTimeout);
      ro.disconnect();
      window.removeEventListener("resize", fit);
      window.removeEventListener("orientationchange", fit);
      window.removeEventListener("load", fit);
    };
  }, [isMobile]);

  return { isMobile, pageRef };
}
