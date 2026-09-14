import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import type { NextRequest } from "next/server";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/** Jednoduchý in-memory rate limit (per instance). Lepší než nic na Vercelu. */
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
): { ok: true } | { ok: false; retryAfterSec: number } {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || cur.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (cur.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }
  cur.count += 1;
  return { ok: true };
}

export function clientIp(req: NextRequest): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) return xf.split(",")[0]?.trim() || "unknown";
  return req.headers.get("x-real-ip") || "unknown";
}

export function rateLimitResponse(retryAfterSec: number) {
  return Response.json(
    { error: "Příliš mnoho požadavků. Zkuste to za chvíli." },
    { status: 429, headers: { "Retry-After": String(retryAfterSec) } },
  );
}

/** Náhodný index 0..max-1 (kryptograficky). */
export function secureRandomIndex(max: number): number {
  if (max <= 0) return 0;
  // Rejection sampling — rovnoměrné rozdělení.
  const limit = Math.floor(256 / max) * max;
  let byte = 0;
  do {
    byte = randomBytes(1)[0];
  } while (byte >= limit);
  return byte % max;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function hmacSign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function hmacVerify(secret: string, payload: string, sig: string): boolean {
  const expected = hmacSign(secret, payload);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
