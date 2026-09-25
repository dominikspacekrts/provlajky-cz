"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { readConsent, subscribeConsent } from "@/lib/consent";

const PARAMS: Record<string, string> = {
  utm_source: "utmSource",
  utm_medium: "utmMedium",
  utm_campaign: "utmCampaign",
  gclid: "gclid",
  gad_source: "gadSource",
  wbraid: "wbraid",
  gbraid: "gbraid",
  fbclid: "fbclid",
  sznclid: "sznclid",
};

const SOURCE_KEY = "provlajky_visit_source";
const SESSION_KEY = "provlajky_visit_session";

function sessionId(): string {
  try {
    const existing = sessionStorage.getItem(SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

function stickySource(): string | null {
  try {
    return sessionStorage.getItem(SOURCE_KEY);
  } catch {
    return null;
  }
}

function rememberSource(source: string) {
  try {
    if (!sessionStorage.getItem(SOURCE_KEY)) sessionStorage.setItem(SOURCE_KEY, source);
  } catch {
    /* private mode */
  }
}

function buildPayload() {
  const params = new URLSearchParams(window.location.search);
  const payload: Record<string, string> = {
    path: window.location.pathname,
    referrer: document.referrer,
    sessionId: sessionId(),
  };

  let hasAttribution = false;
  for (const [from, to] of Object.entries(PARAMS)) {
    const value = params.get(from);
    if (value) {
      payload[to] = value;
      hasAttribution = true;
    }
  }

  // Zdroj z první stránky session držíme i při interní navigaci.
  // Nový UTM / klikací ID má ale přednost (např. klik z mailu).
  const sticky = stickySource();
  if (sticky && !hasAttribution) payload.source = sticky;

  return payload;
}

function postJson(body: Record<string, unknown>, keepalive = false) {
  return fetch("/api/navsteva", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    keepalive,
  });
}

function sendEngage(viewId: string, durationSec: number) {
  if (!viewId || durationSec < 1) return;
  const body = { kind: "engage", id: viewId, durationSec };
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([JSON.stringify(body)], { type: "application/json" });
    if (navigator.sendBeacon("/api/navsteva", blob)) return;
  }
  void postJson(body, true);
}

export default function VisitTracker() {
  const pathname = usePathname();
  const viewIdRef = useRef<string | null>(null);
  const startedAtRef = useRef(0);
  const engagedMsRef = useRef(0);
  const visibleSinceRef = useRef(0);

  useEffect(() => {
    if (!readConsent()?.analytics) {
      const unsub = subscribeConsent(() => {
        if (readConsent()?.analytics) void startView();
      });
      return unsub;
    }

    let cancelled = false;

    async function startView() {
      flushEngage();
      viewIdRef.current = null;
      startedAtRef.current = Date.now();
      engagedMsRef.current = 0;
      visibleSinceRef.current = document.visibilityState === "visible" ? Date.now() : 0;

      try {
        const res = await postJson(buildPayload());
        if (cancelled || !res.ok) return;
        const data = (await res.json()) as { id?: string; source?: string };
        if (data.id) viewIdRef.current = data.id;
        if (data.source) rememberSource(data.source);
      } catch {
        /* tracking must never break the shop */
      }
    }

    function accumulateVisible() {
      if (visibleSinceRef.current) {
        engagedMsRef.current += Date.now() - visibleSinceRef.current;
        visibleSinceRef.current = 0;
      }
    }

    function flushEngage() {
      accumulateVisible();
      const id = viewIdRef.current;
      const sec = Math.round(engagedMsRef.current / 1000);
      viewIdRef.current = null;
      engagedMsRef.current = 0;
      if (id) sendEngage(id, sec);
    }

    function onVisibility() {
      if (document.visibilityState === "hidden") {
        accumulateVisible();
        const id = viewIdRef.current;
        if (id) sendEngage(id, Math.round(engagedMsRef.current / 1000));
      } else {
        visibleSinceRef.current = Date.now();
      }
    }

    void startView();
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", flushEngage);
    const unsub = subscribeConsent(() => {
      if (readConsent()?.analytics) void startView();
    });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", flushEngage);
      unsub();
      flushEngage();
    };
  }, [pathname]);

  return null;
}
