// Volby konfigurátoru vlajek na zakázku: typy oček/uchycení a umístění oček.
// Typy jsou globální (ne per-produkt). `photo` je volitelná cesta k reálné fotce
// v public/vlajky/ocka/ — když soubor existuje, komponenta ji preferuje před ikonou.

export type EyeletType = {
  id: string;
  label: string;
  glyph: EyeletGlyph;
  photo?: string; // volitelně /vlajky/ocka/oko-N.jpg
};

export type EyeletGlyph =
  | "tunnel"
  | "strap-carabiner"
  | "d-ring"
  | "grommet"
  | "windtracker"
  | "carabiner"
  | "hook"
  | "loop"
  | "hem";

export const EYELET_TYPES: EyeletType[] = [
  { id: "tunnel", label: "Tunel (kapsa na tyč)", glyph: "tunnel", photo: "/vlajky/ocka/oko-1.jpg" },
  { id: "strap-carabiner", label: "Popruh s karabinou", glyph: "strap-carabiner", photo: "/vlajky/ocka/oko-2.jpg" },
  { id: "d-ring", label: "Kovový kroužek (D-ring)", glyph: "d-ring", photo: "/vlajky/ocka/oko-3.jpg" },
  { id: "grommet", label: "Kovové oko (průchodka)", glyph: "grommet", photo: "/vlajky/ocka/oko-4.jpg" },
  { id: "windtracker", label: "Vyztužený tunel (windtracker)", glyph: "windtracker", photo: "/vlajky/ocka/oko-5.jpg" },
  { id: "carabiner", label: "Plastová karabina", glyph: "carabiner", photo: "/vlajky/ocka/oko-6.jpg" },
  { id: "hook", label: "Plastový háček", glyph: "hook", photo: "/vlajky/ocka/oko-7.jpg" },
  { id: "loop", label: "Guma se smyčkou", glyph: "loop", photo: "/vlajky/ocka/oko-8.jpg" },
  { id: "hem", label: "Obšitý lem", glyph: "hem", photo: "/vlajky/ocka/oko-9.jpg" },
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
