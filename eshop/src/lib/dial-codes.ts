import { COUNTRIES } from "./countries";

// Telefonní předvolby pro výběr u checkoutu — ne kompletní seznam světa,
// jen realistická podmnožina zákazníků (ČR výchozí, sousedé, zbytek EU,
// pár dalších běžných). Kódy zemí sedí s COUNTRIES v countries.ts, takže
// select může použít stejný český název, který si nevymýšlím znovu.
export const DIAL_CODE_BY_ISO: Record<string, string> = {
  cz: "420",
  sk: "421",
  pl: "48",
  de: "49",
  at: "43",
  hu: "36",
  gb: "44",
  ie: "353",
  fr: "33",
  es: "34",
  it: "39",
  nl: "31",
  be: "32",
  ch: "41",
  se: "46",
  no: "47",
  dk: "45",
  fi: "358",
  pt: "351",
  gr: "30",
  ro: "40",
  bg: "359",
  hr: "385",
  si: "386",
  ua: "380",
  us: "1",
};

export const DEFAULT_DIAL_ISO = "cz";

export type DialCode = { iso: string; dial: string; name: string };

const byIso = new Map(COUNTRIES.map((c) => [c.code, c.name]));

// Pořadí: ČR první (výchozí volba na vršku selectu), zbytek v pořadí, jak jsou
// zapsané výš v DIAL_CODE_BY_ISO.
export const DIAL_CODES: DialCode[] = [
  DEFAULT_DIAL_ISO,
  ...Object.keys(DIAL_CODE_BY_ISO).filter((c) => c !== DEFAULT_DIAL_ISO),
]
  .filter((iso) => byIso.has(iso))
  .map((iso) => ({ iso, dial: DIAL_CODE_BY_ISO[iso], name: byIso.get(iso)! }));

const DIAL_CODES_BY_LENGTH = [...DIAL_CODES].sort((a, b) => b.dial.length - a.dial.length);

/** Rozloží "+420605981155" na { iso: "cz", digits: "605981155" }. Bez rozpoznané
 *  předvolby (nebo bez "+") vrátí výchozí ČR a jen číslice ze vstupu. */
export function parsePhoneValue(value: string): { iso: string; digits: string } {
  const trimmed = (value || "").trim();
  if (trimmed.startsWith("+")) {
    // Nejdelší předvolba nejdřív, ať se "+420…" neurve jako "+4" + zbytek.
    const match = DIAL_CODES_BY_LENGTH.find((d) => trimmed.startsWith(`+${d.dial}`));
    if (match) return { iso: match.iso, digits: trimmed.slice(1 + match.dial.length).replace(/\D/g, "") };
  }
  return { iso: DEFAULT_DIAL_ISO, digits: trimmed.replace(/\D/g, "") };
}
