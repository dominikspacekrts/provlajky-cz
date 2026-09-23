import type { NewsletterCountry } from "./types";

const SUPPORTED: NewsletterCountry[] = ["CZ", "SK", "PL", "HU", "AT", "DE", "EN"];

function normalizeCountry(raw: string): NewsletterCountry {
  const v = (raw || "").trim().toUpperCase();
  if (SUPPORTED.includes(v as NewsletterCountry)) return v as NewsletterCountry;
  const map: Record<string, NewsletterCountry> = {
    CZE: "CZ",
    CZECHIA: "CZ",
    "CZECH REPUBLIC": "CZ",
    CESKO: "CZ",
    ČESKO: "CZ",
    SVK: "SK",
    SLOVAKIA: "SK",
    SLOVENSKO: "SK",
    POL: "PL",
    POLAND: "PL",
    POLSKO: "PL",
    HUN: "HU",
    HUNGARY: "HU",
    MAĎARSKO: "HU",
    MADARSKO: "HU",
    AUT: "AT",
    AUSTRIA: "AT",
    RAKOUSKO: "AT",
    DEU: "DE",
    GER: "DE",
    GERMANY: "DE",
    NEMECKO: "DE",
    NĚMECKO: "DE",
    GB: "EN",
    UK: "EN",
    "UNITED KINGDOM": "EN",
    ENGLAND: "EN",
    "GREAT BRITAIN": "EN",
  };
  return map[v] ?? "EN";
}

function findKey(obj: Record<string, string>, candidates: string[]): string | null {
  const keys = Object.keys(obj);
  for (const c of candidates) {
    const found = keys.find((k) => k.trim().toLowerCase() === c.toLowerCase());
    if (found) return found;
  }
  return null;
}

export type ParsedRiderRow = {
  name: string;
  email: string;
  country: NewsletterCountry;
  phone?: string;
};

export type ParseRidersCsvResult = {
  riders: ParsedRiderRow[];
  skippedNonCzSk: number;
  error?: string;
};

/** Jednoduchý CSV parser (header + řádky). Stačí pro export z mailového klienta. */
function parseCsvRows(text: string): Record<string, string>[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim().length);
  if (lines.length < 2) return [];

  const splitLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === "," || ch === ";") && !inQuotes) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((c) => c.trim());
  };

  const headers = splitLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cols = splitLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] ?? "";
    });
    return row;
  });
}

/**
 * Parsuje CSV jezdců (sloupce Name/Jméno, E-mail, Country/Země, Phone/Telefon).
 * Vrátí jen CZ + SK; ostatní země se počítají ve skippedNonCzSk.
 */
export function parseRidersCsv(text: string): ParseRidersCsvResult {
  const rows = parseCsvRows(text);
  if (!rows.length) {
    return { riders: [], skippedNonCzSk: 0, error: "CSV neobsahuje žádné řádky." };
  }

  const sample = rows[0];
  const nameKey = findKey(sample, ["Name", "Jméno", "Jmeno", "Driver", "Full Name"]);
  const emailKey = findKey(sample, ["E-mail", "Email", "E mail", "Mail"]);
  const countryKey = findKey(sample, ["Country", "Země", "Zeme", "Stát", "Stat", "Nationality"]);
  const phoneKey = findKey(sample, ["Phone", "Telefon", "Tel", "Mobile", "Mobil", "Tel.", "Phone Number"]);

  if (!nameKey || !emailKey) {
    return { riders: [], skippedNonCzSk: 0, error: "CSV musí obsahovat sloupce Name (nebo Jméno) a E-mail." };
  }

  let skippedNonCzSk = 0;
  const riders: ParsedRiderRow[] = [];

  for (const row of rows) {
    const name = (row[nameKey] || "").trim();
    const email = (row[emailKey] || "").trim();
    if (!name || !email) continue;
    const country = countryKey ? normalizeCountry(row[countryKey] || "") : ("CZ" as NewsletterCountry);
    if (country !== "CZ" && country !== "SK") {
      skippedNonCzSk++;
      continue;
    }
    riders.push({
      name,
      email,
      country,
      phone: phoneKey ? (row[phoneKey] || "").trim() || undefined : undefined,
    });
  }

  return { riders, skippedNonCzSk };
}
