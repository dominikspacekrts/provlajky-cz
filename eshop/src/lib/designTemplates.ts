// Grafické podklady ke stažení a pravidla „grafický návrh zdarma".
//
// Soubory se šablonami leží v public/podklady/ — když dorazí nové (třeba zvlášť
// pro každou velikost stanu), stačí je tam nahrát a doplnit sem. Klíč slugu
// produktu má přednost před kategorií.

import type { OrderItemDesign, Product, ProductCategory } from "@/lib/types";

export type DesignTemplate = { label: string; href: string };

export type DesignTemplateOpts = {
  /** Query `?size=3×3 m` u variantního konfigurátoru. */
  sizeLabel?: string | null;
  /** Šířka zadní stěny v metrech u tent_walls (3 / 4.5 / 6). */
  backWidthM?: number | null;
};

// Nafukovací stany — šablona zatím chybí (dřívější zip vracel 404).
const TEMPLATES_BY_CATEGORY: Partial<Record<ProductCategory, DesignTemplate[]>> = {};

const TEMPLATES_BY_SLUG: Record<string, DesignTemplate[]> = {};

/** Z "3×4,5 m" / "3x6" vytáhne druhý rozměr (hloubku) v metrech. */
export function parseTentDepthM(sizeLabel?: string | null): number | null {
  if (!sizeLabel) return null;
  const m = sizeLabel.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/i);
  if (!m) return null;
  const depth = Number(m[2]);
  return Number.isFinite(depth) ? depth : null;
}

function nuzkovyTemplatesForDepth(depthM: number | null): DesignTemplate[] {
  // 3×4,5 zatím nemáme PDF — tlačítko schovat (dřív stahovalo 404).
  if (depthM === 3) {
    return [{ label: "Stáhnout podklady 3×3 m", href: "/podklady/nuzkovy-stan-3x3.pdf" }];
  }
  if (depthM === 6) {
    return [{ label: "Stáhnout podklady 3×6 m", href: "/podklady/nuzkovy-stan-3x6.pdf" }];
  }
  return [];
}

export function designTemplatesFor(
  product: Pick<Product, "slug" | "category">,
  opts?: DesignTemplateOpts
): DesignTemplate[] {
  if (TEMPLATES_BY_SLUG[product.slug]) return TEMPLATES_BY_SLUG[product.slug]!;
  if (product.category === "nuzkove-stany") {
    const depth = typeof opts?.backWidthM === "number" ? opts.backWidthM : parseTentDepthM(opts?.sizeLabel);
    return nuzkovyTemplatesForDepth(depth);
  }
  return TEMPLATES_BY_CATEGORY[product.category] ?? [];
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
