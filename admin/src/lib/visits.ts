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

export type VisitRow = {
  created_at: string;
  path: string;
  source: string;
  country: string | null;
  visitor_id: string;
  session_id: string | null;
  duration_sec: number | null;
};

export type VisitBucket = { key: string; label: string; count: number };
export type VisitStats = {
  total: number;
  unique: number;
  sessions: number;
  avgPageSec: number;
  avgSessionSec: number;
  emailClicks: number;
  buckets: VisitBucket[];
  sources: { key: string; label: string; count: number }[];
  pages: { path: string; count: number; avgSec: number }[];
  countries: { code: string; count: number }[];
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

export function aggregateVisits(rows: VisitRow[], period: Period, now = new Date()): VisitStats {
  const today = pragueParts(now);
  const todayKey = dateKey(today);
  const filtered = rows.filter((row) => inPeriod(new Date(row.created_at), period, today, todayKey));

  const buckets = emptyBuckets(period, today, filtered);
  const counts = new Map(buckets.map((bucket) => [bucket.key, 0]));
  const sources = new Map<string, number>();
  const pages = new Map<string, { count: number; duration: number; timed: number }>();
  const countries = new Map<string, number>();
  const visitors = new Set<string>();
  const sessions = new Set<string>();
  const sessionDuration = new Map<string, number>();
  let durationSum = 0;
  let durationCount = 0;
  let emailClicks = 0;

  for (const row of filtered) {
    const parts = pragueParts(new Date(row.created_at));
    const key = bucketKey(parts, period);
    if (counts.has(key)) counts.set(key, (counts.get(key) || 0) + 1);
    sources.set(row.source, (sources.get(row.source) || 0) + 1);
    if (row.source === "email") emailClicks += 1;

    const page = pages.get(row.path) || { count: 0, duration: 0, timed: 0 };
    page.count += 1;
    const dur = Math.max(0, Number(row.duration_sec) || 0);
    if (dur > 0) {
      page.duration += dur;
      page.timed += 1;
      durationSum += dur;
      durationCount += 1;
    }
    pages.set(row.path, page);

    if (row.country) countries.set(row.country, (countries.get(row.country) || 0) + 1);
    visitors.add(row.visitor_id);
    const sid = row.session_id || row.visitor_id;
    sessions.add(sid);
    sessionDuration.set(sid, (sessionDuration.get(sid) || 0) + dur);
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
    buckets: buckets.map((bucket) => ({ ...bucket, count: counts.get(bucket.key) || 0 })),
    sources: [...sources.entries()]
      .sort((a, b) => SOURCE_ORDER.indexOf(a[0]) - SOURCE_ORDER.indexOf(b[0]) || b[1] - a[1])
      .map(([key, count]) => ({ key, label: SOURCE_LABELS[key] || key, count })),
    pages: [...pages.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 15)
      .map(([path, info]) => ({
        path,
        count: info.count,
        avgSec: info.timed ? Math.round(info.duration / info.timed) : 0,
      })),
    countries: [...countries.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([code, count]) => ({ code, count })),
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
