// Volby konfigurátoru vlajek na zakázku: typy oček/uchycení a umístění oček.
// Typy jsou globální (ne per-produkt) — jen textové popisky, bez ikon/fotek.

export type EyeletType = {
  id: string;
  label: string;
};

export const EYELET_TYPES: EyeletType[] = [
  { id: "tunnel", label: "Tunel (kapsa na tyč)" },
  { id: "strap-carabiner", label: "Popruh s karabinou" },
  { id: "d-ring", label: "Kovový kroužek (D-ring)" },
  { id: "grommet", label: "Kovové oko (průchodka)" },
  { id: "windtracker", label: "Vyztužený tunel (windtracker)" },
  { id: "carabiner", label: "Plastová karabina" },
  { id: "hook", label: "Plastový háček" },
  { id: "loop", label: "Guma se smyčkou" },
  { id: "hem", label: "Obšitý lem" },
];

export type EyeletPlacement = "left" | "right" | "top" | "bottom" | "all";

export const EYELET_PLACEMENTS: { id: EyeletPlacement; label: string }[] = [
  { id: "left", label: "Levá strana" },
  { id: "right", label: "Pravá strana" },
  { id: "top", label: "Vrchní strana" },
  { id: "bottom", label: "Spodní strana" },
  { id: "all", label: "Všechny strany" },
];

export const FLAG_PACKAGING_NOTE =
  "Cena za m² zahrnuje standardní balení: výztužná páska + plastové karabiny každých 100 cm " +
  "(každá další karabina – 10 Kč) nebo vlajkový tunel o uvedeném průměru. Vyztužení tunelu windtracker + 10 % k ceně vlajky.";
