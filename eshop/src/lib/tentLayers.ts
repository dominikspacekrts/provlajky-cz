// Vrstvy náhledu nůžkového stanu.
//
// Stěny se dřív kreslily v prohlížeči jako SVG polygony přes fotku. Nešlo to
// dobře: rohy se braly z ruky naměřených čísel (a tři ze čtyř byly odečtené
// z horní hrany střechy místo ze spodní hrany valance, takže stěna přelezla
// přes žlutou valanci) a plochá poloprůhledná výplň vypadala jako sklo.
//
// Teď se všechny kombinace předgenerují do hotových WebP vrstev skriptem
// `scripts/build-tent-walls.mjs` — ten změří rohy přímo z fotky a promítne do
// nich vygenerovanou texturu látky projektivní transformací. Tady už se jen
// skládají obrázky na sebe, takže se náhled nemá jak rozjet.

export type WallType = "half" | "full";
export type SideKey = "front" | "back" | "left" | "right";
export type StageSides = Record<SideKey, { type: WallType } | null>;

/**
 * Pořadí vykreslování odzadu dopředu. Nohy stojí uvnitř stanu, takže patří
 * mezi vzdálené a blízké stěny — přes vzdálené jsou vidět, blízké je zakryjí.
 *
 * Stan je na fotce natočený rohem ke kameře, takže zvenku vidíme zadní a pravou
 * stěnu; levá a přední jsou za nimi. Musí souhlasit s `FACE`
 * v scripts/build-tent-walls.mjs (všechny tři fotky mají stejné postavení kamery).
 */
export const FAR_SIDES: SideKey[] = ["left", "front"];
export const NEAR_SIDES: SideKey[] = ["back", "right"];

export type TentLayers = {
  /** Produktová fotka stanu bez stěn — spodní vrstva a nositel rozměru. */
  photo: string;
  /** Konstrukce a nohy pod valancí (nad vzdálenými stěnami, pod blízkými). */
  posts: string;
  /** Střecha s valancí — jde úplně navrch, aby ji stěna nepřekryla. */
  roof: string;
  /** Cesta k vrstvě jedné stěny. */
  wall: (side: SideKey, type: WallType) => string;
};

const FILE: Record<string, { key: string; photo: string }> = {
  "3": { key: "3", photo: "/stany/nuzkovy-3x3.jpg" },
  "4.5": { key: "45", photo: "/stany/nuzkovy-3x45.jpg" },
  "6": { key: "6", photo: "/stany/nuzkovy-3x6.jpg" },
};

function layers(entry: { key: string; photo: string }): TentLayers {
  const dir = "/stany/vrstvy";
  return {
    photo: entry.photo,
    posts: `${dir}/${entry.key}-nohy.webp`,
    roof: `${dir}/${entry.key}-strecha.webp`,
    wall: (side, type) => `${dir}/${entry.key}-${side}-${type}.webp`,
  };
}

/** Vybere vrstvy podle šířky zadní stěny (3 / 4,5 / 6 m); default je 3×3. */
export function layersForWidth(backWidthM?: number | null): TentLayers {
  if (backWidthM == null) return layers(FILE["3"]);
  return layers(FILE[String(backWidthM)] ?? FILE["3"]);
}
