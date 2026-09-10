// Textové popisy materiálů a konstrukcí pro konfigurátory — ověřené údaje
// z dodavatelských ceníků (HEX: Aluminum tent 600D; banner: Frontlit / Easy Mesh).
// U AIR ceník materiály neuvádí — text je obecný, bez vymyšlených specifikací.

import type { BannerMaterial } from "./money";
import type { ProductCategory } from "./types";

export const BANNER_MATERIAL_BLURB: Record<BannerMaterial, string> = {
  pvc:
    "Klasická PVC plachta Frontlit 500 B1 — hustá, sytě potisknutelná a odolná venku i v dešti. " +
    "Hodí se na fasády, stěny, ploty i eventové plochy. Po obvodu připravíme oka na uchycení.",
  mesh:
    "Síťový banner Easy Mesh 270 propouští vítr, takže drží i na plotě nebo ve výšce. " +
    "Potisk zůstane čitelný, materiál je lehčí než plná plachta a ve větru méně „plachtí“.",
};

export const TENT_PRODUCT_BLURB: Partial<Record<ProductCategory, string>> = {
  "nuzkove-stany":
    "Nůžkový stan s hliníkovým hexagonálním rámem (trubky 40×40 mm, výška nohy až 2,3 m) " +
    "a střechou z oxfordové látky 600D s dvojitou PU úpravou (260 g/m²). " +
    "Látka je voděodolná, UV stabilní a nehořlavá; potisk jde dye-sublimací. " +
    "Stěny (celé i poloviční) jsou ze stejného materiálu — skládá a staví jeden člověk.",
  "nafukovaci-stany":
    "Nafukovací stan s potiskem na míru — po nafouknutí stojí bez šroubování rámu. " +
    "Hodí se na eventy, prezentace a místa, kde potřebujete rychle postavit viditelnou značku. " +
    "Konkrétní rozměr a variantu zvolíte níž; k dodání patří i možnost expresního nebo economy doručení.",
};
