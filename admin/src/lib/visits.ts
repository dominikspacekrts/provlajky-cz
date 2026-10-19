import type { SupabaseClient } from "@supabase/supabase-js";

export const PERIODS = ["den", "tyden", "mesic", "rok", "celkem"] as const;
export type Period = (typeof PERIODS)[number];

export const PERIOD_LABELS: Record<Period, string> = {
  den: "Den",
  tyden: "Týden",
  mesic: "Měsíc",
  rok: "Rok",
  celkem: "Celkem",
};

export const SOURCE_LABELS: Record<string, string> = {
  email: "E-mail / newsletter",
  google_ads: "Google Ads",
  meta: "Meta",
  sklik: "Sklik",
  mergado: "Mergado",
  google: "Google (vyhledávání)",
  seznam: "Seznam",
  direct: "Přímá návštěva",
  other: "Ostatní",
};

const SOURCE_ORDER = [
  "email",
  "google_ads",
  "meta",
  "sklik",
  "mergado",
  "google",
  "seznam",
  "direct",
  "other",
];

export const QUICK_LEAVE_SEC = 3;

export type VisitRow = {
  created_at: string;
  path: string;
  source: string;
  country: string | null;
  visitor_id: string;
  session_id: string | null;
  duration_sec: number | null;
};

export type CartAdd = {
  created_at: string;
  visitor_id: string;
  session_id: string | null;
  product_name: string;
  product_slug: string;
  variant: string | null;
  qty: number;
  path: string | null;
};

export type VisitBucket = { key: string; label: string; count: number };
export type VisitPageStat = {
  path: string;
  count: number;
  avgSec: number;
  totalSec: number;
  bounceCount: number;
};
export type VisitPerson = {
  id: string;
  firstAt: string;
  lastAt: string;
  source: string;
  country: string | null;
  hasCart: boolean;
  totalSec: number;
  pages: { at: string; path: string; sec: number }[];
  cart: { at: string; name: string; variant: string | null; qty: number }[];
};
export type VisitStats = {
  total: number;
  unique: number;
  sessions: number;
  avgPageSec: number;
  avgSessionSec: number;
  emailClicks: number;
  cartAdds: number;
  buckets: VisitBucket[];
  sources: { key: string; label: string; count: number }[];
  pages: VisitPageStat[];
  countries: { code: string; count: number }[];
  people: VisitPerson[];
  truncated: boolean;
};

function pragueParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Prague",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || "00";
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour").padStart(2, "0"),
  };
}

function dateKey(parts: ReturnType<typeof pragueParts>) {
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function parsePeriod(value: string | undefined): Period {
  return PERIODS.includes(value as Period) ? (value as Period) : "den";
}

function sinceIso(period: Period): string | null {
  const day = 24 * 60 * 60 * 1000;
  const now = Date.now();
  if (period === "den") return new Date(now - 2 * day).toISOString();
  if (period === "tyden") return new Date(now - 8 * day).toISOString();
  if (period === "mesic") return new Date(now - 35 * day).toISOString();
  if (period === "rok") return new Date(now - 370 * day).toISOString();
  return null;
}

export async function loadVisitRows(
  supabase: SupabaseClient,
  period: Period,
): Promise<{ rows: VisitRow[]; error: { code?: string; message: string } | null; truncated: boolean }> {
  const since = sinceIso(period);
  const rows: VisitRow[] = [];
  const pageSize = 1000;
  let truncated = false;
  for (let from = 0; from < 20000; from += pageSize) {
    let query = supabase
      .from("page_views")
      .select("created_at,path,source,country,visitor_id,session_id,duration_sec")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query;
    if (error) return { rows: [], error, truncated: false };
    rows.push(...((data || []) as VisitRow[]));
    if (!data || data.length < pageSize) return { rows, error: null, truncated: false };
    if (from + pageSize >= 20000) truncated = true;
  }
  return { rows, error: null, truncated };
}

export async function loadCartAdds(
  supabase: SupabaseClient,
  period: Period,
): Promise<{ rows: CartAdd[]; missing: boolean }> {
  const since = sinceIso(period);
  const rows: CartAdd[] = [];
  const pageSize = 1000;
  for (let from = 0; from < 20000; from += pageSize) {
    let query = supabase
      .from("cart_adds")
      .select("created_at,visitor_id,session_id,product_name,product_slug,variant,qty,path")
      .order("created_at", { ascending: true })
      .range(from, from + pageSize - 1);
    if (since) query = query.gte("created_at", since);
    const { data, error } = await query;
    if (error) return { rows: [], missing: isMissingCartTable(error) };
    rows.push(...((data || []) as CartAdd[]));
    if (!data || data.length < pageSize) return { rows, missing: false };
  }
  return { rows, missing: false };
}

export function formatDuration(sec: number): string {
  if (!sec || sec < 1) return "—";
  if (sec < 60) return `${sec} s`;
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m < 60) return s ? `${m} min ${s} s` : `${m} min`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h} h ${rem} min` : `${h} h`;
}

export function formatVisitWhen(iso: string, period: Period) {
  return new Intl.DateTimeFormat("cs-CZ", {
    timeZone: "Europe/Prague",
    ...(period === "den" ? {} : { day: "numeric", month: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function shortVisitorId(id: string) {
  return id.replace(/-/g, "").slice(0, 8);
}

export type VisitPersonView = {
  id: string;
  shortId: string;
  sourceLabel: string;
  lastLabel: string;
  totalLabel: string;
  hasCart: boolean;
  pages: { when: string; path: string; time: string }[];
  cart: { when: string; label: string }[];
};

export function visitPeopleView(people: VisitPerson[], period: Period): VisitPersonView[] {
  return people.map((person) => ({
    id: person.id,
    shortId: shortVisitorId(person.id),
    sourceLabel: SOURCE_LABELS[person.source] || person.source || "—",
    lastLabel: formatVisitWhen(person.lastAt, period),
    totalLabel: formatDuration(person.totalSec),
    hasCart: person.hasCart,
    pages: person.pages.map((page) => ({
      when: formatVisitWhen(page.at, period),
      path: page.path,
      time: formatDuration(page.sec),
    })),
    cart: person.cart.map((item) => ({
      when: formatVisitWhen(item.at, period),
      label: [item.name, item.variant, item.qty > 1 ? `${item.qty} ks` : ""]
        .filter(Boolean)
        .join(" · "),
    })),
  }));
}

export function aggregateVisits(
  rows: VisitRow[],
  period: Period,
  now = new Date(),
  cartAdds: CartAdd[] = [],
): VisitStats {
  const today = pragueParts(now);
  const todayKey = dateKey(today);
  const filtered = rows.filter((row) => inPeriod(new Date(row.created_at), period, today, todayKey));
  const carts = cartAdds.filter((row) => inPeriod(new Date(row.created_at), period, today, todayKey));

  const buckets = emptyBuckets(period, today, filtered);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const sources = new Map<string, number>();
  const pages = new Map<string, { count: number; duration: number; timed: number; bounceCount: number }>();
  const countries = new Map<string, number>();
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const sessionDuration = new Map<string, number>();
  const people = new Map<string, VisitPerson>();
  let durationSum = 0;
  let durationCount = 0;
  let emailClicks = 0;

  function personOf(id: string, at: string, source: string, country: string | null): VisitPerson {
    const existing = people.get(id);
    if (existing) {
      if (at < existing.firstAt) existing.firstAt = at;
      if (at > existing.lastAt) existing.lastAt = at;
      if (!existing.source && source) existing.source = source;
      if (!existing.country && country) existing.country = country;
      return existing;
    }
    const created: VisitPerson = {
      id,
      firstAt: at,
      lastAt: at,
      source,
      country,
      hasCart: false,
      totalSec: 0,
      pages: [],
      cart: [],
    };
    people.set(id, created);
    return created;
  }

  for (const row of filtered) {
    const parts = pragueParts(new Date(row.created_at));
    const key = bucketKey(parts, period);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
    sources.set(row.source, (sources.get(row.source) || 0) + 1);
    if (row.source === "email") emailClicks += 1;

    const page = pages.get(row.path) || { count: 0, duration: 0, timed: 0, bounceCount: 0 };
    page.count += 1;
    const dur = Math.max(0, Number(row.duration_sec) || 0);
    if (dur > 0) {
      page.duration += dur;
      page.timed += 1;
      durationSum += dur;
      durationCount += 1;
    }
    if (dur < QUICK_LEAVE_SEC) page.bounceCount += 1;
    pages.set(row.path, page);

    if (row.country) countries.set(row.country, (countries.get(row.country) || 0) + 1);
    visitors.add(row.visitor_id);
    const sid = row.session_id || row.visitor_id;
    sessions.add(sid);
    sessionDuration.set(sid, (sessionDuration.get(sid) || 0) + dur);

    const person = personOf(row.visitor_id, row.created_at, row.source, row.country);
    person.pages.push({ at: row.created_at, path: row.path, sec: dur });
    person.totalSec += dur;
  }

  for (const add of carts) {
    const person = personOf(add.visitor_id, add.created_at, "", null);
    person.hasCart = true;
    person.cart.push({
      at: add.created_at,
      name: add.product_name,
      variant: add.variant,
      qty: add.qty,
    });
  }

  const sessionSecs = [...sessionDuration.values()].filter((v) => v > 0);
  const avgSessionSec = sessionSecs.length
    ? Math.round(sessionSecs.reduce((a, b) => a + b, 0) / sessionSecs.length)
    : 0;

  return {
    total: filtered.length,
    unique: visitors.size,
    sessions: sessions.size,
    avgPageSec: durationCount ? Math.round(durationSum / durationCount) : 0,
    avgSessionSec,
    emailClicks,
    cartAdds: carts.length,
    buckets: buckets.map((bucket) => ({ ...bucket, count: counts.get(bucket.key) || 0 })),
    sources: [...sources.entries()]
      .sort((a, b) => SOURCE_ORDER.indexOf(a[0]) - SOURCE_ORDER.indexOf(b[0]) || b[1] - a[1])
      .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] || key, count })),
    pages: [...pages.entries()]
      .sort((a, b) => b[1].duration - a[1].duration || b[1].count - a[1].count)
      .slice(0, 15)
      .map(([path, info]) => ({
        path,
        count: info.count,
        totalSec: info.duration,
        avgSec: info.timed ? Math.round(info.duration / info.timed) : 0,
        bounceCount: info.bounceCount,
      })),
    countries: [...countries.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count })),
    people: [...people.values()]
      .map((person) => ({
        ...person,
        pages: [...person.pages].sort((a, b) => a.at.localeCompare(b.at)),
        cart: [...person.cart].sort((a, b) => a.at.localeCompare(b.at)),
      }))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt) || Number(b.hasCart) - Number(a.hasCart)),
    truncated: false,
  };
}

function inPeriod(date: Date, period: Period, today: ReturnType<typeof pragueParts>, todayKey: string) {
  const parts = pragueParts(date);
  if (period === "den") return dateKey(parts) === todayKey;
  if (period === "tyden") {
    const start = addDays(today, -6);
    return dateKey(parts) >= dateKey(start) && dateKey(parts) <= todayKey;
  }
  if (period === "mesic") return parts.year === today.year && parts.month === today.month;
  if (period === "rok") return parts.year === today.year;
  return true;
}

function addDays(parts: ReturnType<typeof pragueParts>, days: number) {
  const utc = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  utc.setUTCDate(utc.getUTCDate() + days);
  return {
    year: String(utc.getUTCFullYear()),
    month: String(utc.getUTCMonth() + 1).padStart(2, "0"),
    day: String(utc.getUTCDate()).padStart(2, "0"),
    hour: "00",
  };
}

function bucketKey(parts: ReturnType<typeof pragueParts>, period: Period) {
  if (period === "den") return parts.hour;
  if (period === "tyden" || period === "mesic") return dateKey(parts);
  if (period === "rok") return `${parts.year}-${parts.month}`;
  return parts.year;
}

function emptyBuckets(period: Period, today: ReturnType<typeof pragueParts>, rows: VisitRow[]): VisitBucket[] {
  if (period === "den") {
    return Array.from({ length: 24 }, (_, hour) => {
      const key = String(hour).padStart(2, "0");
      return { key, label: `${key}:00`, count: 0 };
    });
  }
  if (period === "tyden") {
    return Array.from({ length: 7 }, (_, index) => {
      const parts = addDays(today, index - 6);
      return { key: dateKey(parts), label: `${Number(parts.day)}. ${Number(parts.month)}.`, count: 0 };
    });
  }
  if (period === "mesic") {
    const last = Number(today.day);
    return Array.from({ length: last }, (_, index) => {
      const day = String(index + 1).padStart(2, "0");
      return { key: `${today.year}-${today.month}-${day}`, label: `${index + 1}. ${Number(today.month)}.`, count: 0 };
    });
  }
  if (period === "rok") {
    const last = Number(today.month);
    return Array.from({ length: last }, (_, index) => {
      const month = String(index + 1).padStart(2, "0");
      return { key: `${today.year}-${month}`, label: monthName(index), count: 0 };
    });
  }
  const years = new Set(rows.map((row) => pragueParts(new Date(row.created_at)).year));
  years.add(today.year);
  return [...years].sort().map((year) => ({ key: year, label: year, count: 0 }));
}

function monthName(index: number) {
  return ["led", "úno", "bře", "dub", "kvě", "čvn", "čvc", "srp", "zář", "říj", "lis", "pro"][index] || "";
}

export function isMissingVisitsTable(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /page_views/.test(error.message || ""));
}

export function isMissingCartTable(error: { code?: string; message?: string } | null) {
  return !!error && (error.code === "42P01" || error.code === "PGRST205" || /cart_adds/.test(error.message || ""));
}
