// Grafické podklady ke stažení a pravidla „grafický návrh zdarma".
//
// Soubory se šablonami leží v public/podklady/ — když dorazí nové (třeba zvlášť
// pro každou velikost stanu), stačí je tam nahrát a doplnit sem. Klíč slugu
// produktu má přednost před kategorií.

import type { OrderItemDesign, Product, ProductCategory } from "@/lib/types";

export type DesignTemplate = { label: string; href: string };

const TEMPLATES_BY_CATEGORY: Partial<Record<ProductCategory, DesignTemplate[]>> = {
  "nuzkove-stany": [{ label: "Stáhnout podklady pro grafiku", href: "/podklady/nuzkovy-stan.zip" }],
  "nafukovaci-stany": [{ label: "Stáhnout podklady pro grafiku", href: "/podklady/nafukovaci-stan.zip" }],
};

const TEMPLATES_BY_SLUG: Record<string, DesignTemplate[]> = {};

export function designTemplatesFor(product: Pick<Product, "slug" | "category">): DesignTemplate[] {
  return TEMPLATES_BY_SLUG[product.slug] ?? TEMPLATES_BY_CATEGORY[product.category] ?? [];
}

/** Zakázková výroba = vše kromě příslušenství a náhradních dílů. */
export function isCustomMadeCategory(category: ProductCategory | null | undefined): boolean {
  return Boolean(category) && category !== "prislusenstvi" && category !== "nahradni-dily";
}

export type ArtworkMode = "own" | "free";
export type FreeDesignLogo = { dataUrl: string; name: string };

/** Logo projde celou objednávkou jako base64 — větší soubory ať pošle e-mailem. */
export const FREE_DESIGN_LOGO_MAX_BYTES = 3 * 1024 * 1024;

export function freeDesignNote(logo: FreeDesignLogo | null): string {
  return logo
    ? "Grafika: návrh zdarma, logo přiloženo"
    : "Grafika: návrh zdarma, logo pošle zákazník e-mailem";
}

export const OWN_ARTWORK_PENDING_NOTE = "Grafika: vlastní, zákazník dodá";

/** Design položky pro admin: jen přiložené logo, umístění řeší grafik. */
export function freeDesignOrderDesign(logo: FreeDesignLogo | null): OrderItemDesign {
  return {
    source: "eshop",
    freeDesign: true,
    thumb: null,
    logo: logo ? { src: logo.dataUrl, x: 0.3, y: 0.3, w: 0.4, h: 0.4, rotation: 0 } : null,
    logoFileName: logo?.name,
  };
}
