import type { NewsletterCountry } from "./types";

/** Křestní jméno z celého jména; „JAN“ → „Jan“. */
export function firstName(fullName: string): string {
  const part = (fullName || "").trim().split(/\s+/)[0] || "";
  if (part.length > 1 && part === part.toUpperCase()) {
    return part.charAt(0) + part.slice(1).toLowerCase();
  }
  return part;
}

const VOWELS = "aeiouyáéíóúůýě";

/**
 * Vokativ běžných českých křestních jmen (5. pád).
 * Petra → Petro, Petr → Petře, Tomáš → Tomáši, Marek → Marku, Pavel → Pavle,
 * Dominik → Dominiku, Jan → Jane. Neznámé tvary se radši nechají v 1. pádě.
 * SK: bez vokativu. Šablona mailu je vždy česky — liší se jen oslovení.
 */
export function czechVocativeFirst(name: string): string {
  const n = firstName(name);
  if (!n) return "";
  const lower = n.toLowerCase();
  const last = lower.slice(-1);
  const prev = lower.slice(-2, -1);

  if (last === "a") return lower.endsWith("ia") ? n : n.slice(0, -1) + "o";
  if (VOWELS.includes(last) || last === "í") return n;
  if (lower.endsWith("něk")) return n.slice(0, -3) + "ňku";
  if (lower.endsWith("ek")) return n.slice(0, -2) + "ku";
  if (lower === "pavel" || lower === "karel") return n.slice(0, -2) + "le";
  if (lower.endsWith("iel") || lower.endsWith("cel")) return n + "i";
  if (lower.endsWith("ch") || last === "k" || last === "h" || last === "g") return n + "u";
  if ("šžčřjcxďťň".includes(last)) return n + "i";
  if (last === "r" && prev && !VOWELS.includes(prev)) return n.slice(0, -1) + "ře";
  if ("rndtvmlszbpf".includes(last)) return n + "e";
  return n;
}

export function newsletterGreeting(fullName: string, country: NewsletterCountry | string): string {
  const first = firstName(fullName);
  if (!first) return "Ahoj,";
  if (country === "SK") return `Ahoj ${first},`;
  return `Ahoj ${czechVocativeFirst(fullName)},`;
}
