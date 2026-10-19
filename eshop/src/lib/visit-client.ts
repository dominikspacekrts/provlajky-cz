import { readConsent } from "./consent";

export const VISIT_SOURCE_KEY = "provlajky_visit_source";
export const VISIT_SESSION_KEY = "provlajky_visit_session";

export function visitSessionId(): string {
  try {
    const existing = sessionStorage.getItem(VISIT_SESSION_KEY);
    if (existing && /^[0-9a-f-]{36}$/i.test(existing)) return existing;
    const id = crypto.randomUUID();
    sessionStorage.setItem(VISIT_SESSION_KEY, id);
    return id;
  } catch {
    return crypto.randomUUID();
  }
}

export function reportCartAdd(input: { name: string; slug: string; variant?: string | null; qty: number }) {
  if (typeof window === "undefined") return;
  if (!readConsent()?.analytics) return;
  const body = {
    kind: "cart",
    path: window.location.pathname,
    sessionId: visitSessionId(),
    productName: input.name,
    productSlug: input.slug,
    variant: input.variant || null,
    qty: input.qty,
  };
  const json = JSON.stringify(body);
  if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
    const blob = new Blob([json], { type: "application/json" });
    if (navigator.sendBeacon("/api/navsteva", blob)) return;
  }
  void fetch("/api/navsteva", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: json,
    keepalive: true,
  }).catch(() => {});
}
