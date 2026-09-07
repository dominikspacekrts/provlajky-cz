// Geometrie nůžkového stanu na produktové fotce — aby šlo do fotky živě
// dokreslovat stěny podle toho, co si zákazník naklikal v konfigurátoru.
//
// Vrstvení hotových fotek stěn z Viewmaxu se neosvědčilo: model při každé
// generaci scénu lehce posune a přeškáluje (naměřeno 11–15 % změněné plochy
// tam, kde měla přibýt jen jedna stěna) a čtyři strany od sebe nerozliší
// (dvě zadní varianty vyšly identické na 0,2 %). Stěna je ale plochý
// čtyřúhelník, takže se dá vykreslit přesně — stačí znát rohy.
//
// Souřadnice jsou v poměru 0..1 vůči rozměru snímku, takže nezávisí na
// rozlišení ani na tom, jak velký je stage na displeji. Naměřeno skriptem
// ze snímků v public/stany (žlutá střecha → rohy okapu, svislý sken → paty).

export type Pt = readonly [number, number];

export type TentPhotoGeometry = {
  /** Produktová fotka stanu bez stěn. */
  image: string;
  /** Rohy okapu: L/R = levý a pravý viditelný roh, F = přední (nejbližší), B = zadní (skrytý). */
  eave: { L: Pt; R: Pt; F: Pt; B: Pt };
  /** Y-ová souřadnice paty nohy pod odpovídajícím rohem (nohy jsou na snímku svislé). */
  foot: { L: number; R: number; F: number; B: number };
};

// Zadní pata je skrytá za konstrukcí — dopočítá se z rovnoběžníku podlahy.
const footB = (L: number, R: number, F: number) => +(L + R - F).toFixed(4);

export const TENT_PHOTO_GEOMETRY: Record<string, TentPhotoGeometry> = {
  "3": {
    image: "/stany/nuzkovy-3x3.jpg",
    eave: { L: [0.1175, 0.318], R: [0.8812, 0.3222], F: [0.53, 0.4293], B: [0.4688, 0.2109] },
    foot: { L: 0.8519, R: 0.851, F: 0.913, B: footB(0.8519, 0.851, 0.913) },
  },
  "4.5": {
    image: "/stany/nuzkovy-3x45.jpg",
    eave: { L: [0.0825, 0.3297], R: [0.9231, 0.3582], F: [0.6262, 0.436], B: [0.3794, 0.2519] },
    foot: { L: 0.8268, R: 0.8008, F: 0.8586, B: footB(0.8268, 0.8008, 0.8586) },
  },
  "6": {
    image: "/stany/nuzkovy-3x6.jpg",
    eave: { L: [0.0825, 0.3314], R: [0.9231, 0.3582], F: [0.6175, 0.436], B: [0.3881, 0.2536] },
    foot: { L: 0.8268, R: 0.8, F: 0.8561, B: footB(0.8268, 0.8, 0.8561) },
  },
};

/** Vybere geometrii podle šířky zadní stěny (3 / 4,5 / 6 m); default je 3×3. */
export function geometryForWidth(backWidthM?: number | null): TentPhotoGeometry {
  if (backWidthM == null) return TENT_PHOTO_GEOMETRY["3"];
  const key = String(backWidthM);
  return TENT_PHOTO_GEOMETRY[key] ?? TENT_PHOTO_GEOMETRY["3"];
}
