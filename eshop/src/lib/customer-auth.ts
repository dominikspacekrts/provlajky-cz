import { createHash, createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import bcrypt from "bcryptjs";
import type { CustomerAddress } from "@/lib/types";
import { hmacSign, hmacVerify, secureRandomIndex } from "@/lib/security";

export const SESSION_COOKIE = "provlajky_customer";
export const PURCHASE_ACCESS_COOKIE = "provlajky_purchase";
const SESSION_DAYS = 30;
const BCRYPT_ROUNDS = 12;
const MAX_SHIPPING_ADDRESSES = 10;
const PURCHASE_ACCESS_MS = 2 * 60 * 60 * 1000;

export type ShippingAddressRow = {
  id: string;
  customer_id: string;
  label: string | null;
  company: string | null;
  name: string | null;
  street: string;
  psc: string;
  city: string;
  created_at: string;
};

export type CustomerProfile = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  discount_code: string;
  discount_pct: number;
  used_at: string | null;
  billing: CustomerAddress | null;
  has_password: boolean;
  shipping_addresses: ShippingAddressRow[];
};

function sessionSecret(): string {
  const secret = process.env.CUSTOMER_SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  // Lokální vývoj bez Vercel secretu — nikdy v produkci/preview.
  if (process.env.NODE_ENV !== "production" && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return `dev-only:${process.env.SUPABASE_SERVICE_ROLE_KEY}`.slice(0, 64);
  }
  throw new Error("CUSTOMER_SESSION_SECRET must be set (min. 32 characters).");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function isStrongEnoughPassword(password: string): boolean {
  if (password.length < 8) return false;
  if (!/[A-Za-zÀ-ž]/.test(password)) return false;
  if (!/[0-9]/.test(password)) return false;
  return true;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

function signPayload(payloadJson: string): string {
  const payload = b64url(Buffer.from(payloadJson, "utf8"));
  const sig = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function verifySigned(token: string): { customerId: string; exp: number; sv?: number } | null {
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return null;
  const expected = createHmac("sha256", sessionSecret()).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
      customerId?: string;
      exp?: number;
      sv?: number;
    };
    if (!data.customerId || !data.exp || data.exp < Date.now()) return null;
    return { customerId: data.customerId, exp: data.exp, sv: data.sv };
  } catch {
    return null;
  }
}

export async function createSessionCookie(customerId: string, sessionVersion = 1): Promise<void> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const token = signPayload(JSON.stringify({ customerId, exp, sv: sessionVersion }));
  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

export async function getSessionCustomerId(): Promise<string | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const parsed = verifySigned(token);
    if (!parsed) return null;
    // Ověření session_version proti DB probíhá v getLoggedInProfile.
    return parsed.customerId;
  } catch {
    return null;
  }
}

export async function getSessionPayload(): Promise<{ customerId: string; sv: number } | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  try {
    const parsed = verifySigned(token);
    if (!parsed) return null;
    return { customerId: parsed.customerId, sv: parsed.sv ?? 1 };
  } catch {
    return null;
  }
}

/** Krátkodobý přístup k analytics/PII na děkovací stránce (2 h). */
export function createPurchaseAccessToken(orderId: string): string {
  const exp = Date.now() + PURCHASE_ACCESS_MS;
  const payload = `${orderId}.${exp}`;
  const sig = hmacSign(sessionSecret(), payload);
  return `${payload}.${sig}`;
}

export function verifyPurchaseAccessToken(token: string, orderId: string): boolean {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [id, expStr, sig] = parts;
  if (id !== orderId) return false;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  return hmacVerify(sessionSecret(), `${id}.${expStr}`, sig);
}

export async function setPurchaseAccessCookie(orderId: string): Promise<void> {
  const token = createPurchaseAccessToken(orderId);
  const jar = await cookies();
  jar.set(PURCHASE_ACCESS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(PURCHASE_ACCESS_MS / 1000),
  });
}

export async function getPurchaseAccessCookie(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(PURCHASE_ACCESS_COOKIE)?.value ?? null;
}

export function hashToken(rawToken: string): string {
  return createHash("sha256").update(rawToken).digest("hex");
}

export function generateRawToken(): string {
  return randomBytes(32).toString("base64url");
}

export const DISCOUNT_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const DISCOUNT_CODE_LENGTH = 8;
export const DEFAULT_DISCOUNT_PCT = 10;

export function generateDiscountCode(): string {
  let code = "";
  for (let i = 0; i < DISCOUNT_CODE_LENGTH; i++) {
    code += DISCOUNT_CODE_CHARS[secureRandomIndex(DISCOUNT_CODE_CHARS.length)];
  }
  return code;
}

export { MAX_SHIPPING_ADDRESSES };
