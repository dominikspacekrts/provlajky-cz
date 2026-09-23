import type { NewsletterCountry } from "./types";

/** Křestní jméno z celého jména. */
export function firstName(fullName: string): string {
  const part = (fullName || "").trim().split(/\s+/)[0] || "";
  return part;
}

/**
 * Jednoduchý vokativ pro běžná česká mužská jména končící na souhlásku.
 * SK: bez vokativu. Šablona mailu je vždy česky — liší se jen oslovení.
 */
export function czechVocativeFirst(name: string): string {
  const n = firstName(name);
  if (!n) return "";
  const lower = n.toLowerCase();
  // ženská -a → -o (Petra → Petro)
  if (lower.endsWith("a") && !lower.endsWith("ia")) {
    return n.slice(0, -1) + (n === n.toUpperCase() ? "O" : "o");
  }
  // mužská končící na souhlásku — přidej -e / -i / -u podle zakončení
  const last = lower.slice(-1);
  if ("aeiouyáéíóúůýě".includes(last)) return n;
  if (last === "k" || last === "g" || last === "h" || last === "ch".slice(-1)) {
    // Dominik → Dominiku (zjednodušeně -u u -k)
    if (last === "k") return n + (n === n.toUpperCase() ? "U" : "u");
  }
  if (last === "r" || last === "l" || last === "n" || last === "d" || last === "t" || last === "v") {
    return n + (n === n.toUpperCase() ? "E" : "e");
  }
  return n + (n === n.toUpperCase() ? "E" : "e");
}

export function newsletterGreeting(fullName: string, country: NewsletterCountry | string): string {
  const first = firstName(fullName);
  if (!first) return "Ahoj,";
  if (country === "SK") return `Ahoj ${first},`;
  return `Ahoj ${czechVocativeFirst(fullName)},`;
}
