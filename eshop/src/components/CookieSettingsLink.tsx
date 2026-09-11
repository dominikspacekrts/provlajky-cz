"use client";

import { OPEN_CONSENT_EVENT } from "@/components/CookieBanner";

export default function CookieSettingsLink() {
  return (
    <button
      type="button"
      className="nv-cookie-link"
      onClick={() => window.dispatchEvent(new Event(OPEN_CONSENT_EVENT))}
    >
      Nastavení cookies
    </button>
  );
}
