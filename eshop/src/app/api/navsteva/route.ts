import { NextRequest, NextResponse } from "next/server";
import { CONSENT_COOKIE, parseConsent } from "@/lib/consent";
import { createServiceClient } from "@/lib/supabase";
import { clientIp, rateLimit } from "@/lib/security";
import { classifyVisit, type VisitSource } from "@/lib/visit-source";

export const dynamic = "force-dynamic";

const VISITOR_COOKIE = "provlajky_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 183;
const MAX_DURATION_SEC = 60 * 60;

function countryFrom(req: NextRequest): string | null {
  const raw = req.headers.get("x-vercel-ip-country") || req.headers.get("cf-ipcountry") || "";
  const code = raw.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) && code !== "XX" ? code : null;
}

function safePath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (!value.startsWith("/") || value.startsWith("//") || value.length > 200) return null;
  if (value.startsWith("/api")) return null;
  return value;
}

function str(value: unknown, max = 120): string | null {
  return typeof value === "string" ? value.slice(0, max) : null;
}

function uuidOrNull(value: unknown): string | null {
  return typeof value === "string" && /^[0-9a-f-]{36}$/i.test(value) ? value : null;
}

function visitorIdFrom(req: NextRequest): string {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  return existing && /^[0-9a-f-]{36}$/i.test(existing) ? existing : crypto.randomUUID();
}

function attachVisitorCookie(res: NextResponse, req: NextRequest, visitorId: string) {
  const existing = req.cookies.get(VISITOR_COOKIE)?.value;
  if (existing === visitorId) return;
  res.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure: req.nextUrl.protocol === "https:",
    path: "/",
    maxAge: VISITOR_MAX_AGE,
  });
}

function noContent() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(req: NextRequest) {
  const consent = parseConsent(req.cookies.get(CONSENT_COOKIE)?.value);
  if (!consent?.analytics) return noContent();

  const limited = rateLimit(`navsteva:${clientIp(req)}`, { limit: 60, windowMs: 60_000 });
  if (!limited.ok) return noContent();

  if (req.headers.get("sec-purpose") === "prefetch" || req.headers.get("purpose") === "prefetch") {
    return noContent();
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return noContent();
  }

  // Doplnění času stráveného na předchozí stránce.
  if (body.kind === "engage") {
    const id = uuidOrNull(body.id);
    const visitorId = visitorIdFrom(req);
    const durationSec = Math.min(
      MAX_DURATION_SEC,
      Math.max(0, Math.round(typeof body.durationSec === "number" ? body.durationSec : Number(body.durationSec) || 0)),
    );
    if (!id || durationSec < 1) return noContent();

    await createServiceClient()
      .from("page_views")
      .update({ duration_sec: durationSec })
      .eq("id", id)
      .eq("visitor_id", visitorId);

    const res = noContent();
    attachVisitorCookie(res, req, visitorId);
    return res;
  }

  const path = safePath(body.path);
  if (!path) return noContent();

  const sticky = str(body.source) as VisitSource | null;
  const source =
    sticky &&
    [
      "email",
      "google_ads",
      "meta",
      "sklik",
      "mergado",
      "google",
      "seznam",
      "direct",
      "other",
    ].includes(sticky)
      ? sticky
      : classifyVisit({
          referrer: str(body.referrer),
          utmSource: str(body.utmSource),
          utmMedium: str(body.utmMedium),
          utmCampaign: str(body.utmCampaign),
          gclid: str(body.gclid),
          gadSource: str(body.gadSource),
          wbraid: str(body.wbraid),
          gbraid: str(body.gbraid),
          fbclid: str(body.fbclid),
          sznclid: str(body.sznclid),
        });

  const visitorId = visitorIdFrom(req);
  const sessionId = uuidOrNull(body.sessionId) || crypto.randomUUID();

  const { data, error } = await createServiceClient()
    .from("page_views")
    .insert({
      path,
      source,
      country: countryFrom(req),
      visitor_id: visitorId,
      session_id: sessionId,
      duration_sec: 0,
    })
    .select("id")
    .single();

  if (error || !data) return noContent();

  const res = NextResponse.json({ id: data.id, source, sessionId });
  attachVisitorCookie(res, req, visitorId);
  return res;
}
