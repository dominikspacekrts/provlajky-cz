// Skladové barvy nůžkových stanů (Inventory Colors z dodavatelského listu).
// Hex hodnoty jsou přibližné vizuální ekvivalenty Pantone kódů pro výběr v UI.

export type TentColor = { id: string; label: string; hex: string };

/** Střecha, zipové kryty a stěny — bez potisku. */
export const TENT_FABRIC_COLORS: TentColor[] = [
  { id: "6C", label: "6C", hex: "#2B2B2B" },
  { id: "429C", label: "429C", hex: "#A8A9AD" },
  { id: "Natural", label: "Natural", hex: "#F4F4F0" },
  { id: "2174C", label: "2174C", hex: "#4B8FCE" },
  { id: "200C", label: "200C", hex: "#C8102E" },
  { id: "123C", label: "123C", hex: "#FFC72C" },
];

/** Barvení rámu / nohou — bez žluté 123C. */
export const TENT_FRAME_COLORS: TentColor[] = TENT_FABRIC_COLORS.filter((c) => c.id !== "123C");

export const DEFAULT_FRAME_COLOR_BUY = 1000;
export const DEFAULT_FRAME_COLOR_SELL = 2000;
