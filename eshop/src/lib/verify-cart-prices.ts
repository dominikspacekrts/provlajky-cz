import {
  bannerPrice,
  customFlagPrice,
  variantSellPrice,
  type BannerMaterial,
  type DeliverySpeed,
} from "@/lib/money";
import type { CartLine, Product } from "@/lib/types";

const PRICE_TOLERANCE = 1; // Kč — zaokrouhlení
const MAX_LINES = 40;
const MAX_ARTWORK_BYTES = 3.5 * 1024 * 1024;

export { MAX_LINES, MAX_ARTWORK_BYTES };

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) <= PRICE_TOLERANCE;
}

/** Očekávaná cena z katalogu, nebo null když nejde spočítat. */
export function catalogUnitPrice(product: Product, line: CartLine): number | null {
  const vatOk = product.vat_rate;
  void vatOk;

  switch (product.kind) {
    case "simple":
      return product.price || 0;

    case "configurable": {
      const size = line.size;
      if (!size) return null;
      return product.price_by_size?.[size] ?? null;
    }

    case "banner_m2": {
      const mat = (line.material === "mesh" ? "mesh" : "pvc") as BannerMaterial;
      const pricing = product.config?.banner?.[mat];
      if (!pricing || !line.widthCm || !line.heightCm) return null;
      return bannerPrice(pricing, line.widthCm, line.heightCm);
    }

    case "variant": {
      const v = (product.config?.variants ?? []).find((x) => x.id === line.variantId);
      if (!v) return null;
      const note = (line.note || "").toLowerCase();
      const speeds: DeliverySpeed[] = [];
      if (note.includes("economy") || note.includes("vlakem") || note.includes("2 měs")) speeds.push("slow");
      if (note.includes("expres") || note.includes("14") || note.includes("leteck")) speeds.push("fast");
      if (speeds.length === 0) {
        // Zkus obě — akceptuj shodu s kteroukoli.
        const air = variantSellPrice(v, "fast");
        const train = variantSellPrice(v, "slow");
        if (closeEnough(line.unitPrice, air)) return air;
        if (closeEnough(line.unitPrice, train)) return train;
        return air > 0 ? air : train;
      }
      return variantSellPrice(v, speeds[0]);
    }

    case "options": {
      const opt = (product.config?.options ?? []).find((o) => o.id === line.optionId);
      return opt?.sellPrice ?? null;
    }

    case "custom_flag": {
      const mats = product.config?.customFlag?.materials ?? [];
      const mat = mats.find((m) => m.id === line.material) ?? mats[0];
      if (!mat || !line.widthCm || !line.heightCm) return null;
      const dense = (line.note || "").toLowerCase().includes("hustší");
      const surcharge = product.config?.customFlag?.eyeletSurchargePct ?? 0;
      return customFlagPrice(mat, line.widthCm, line.heightCm, dense, surcharge);
    }

    case "tent_walls": {
      const cfg = product.config?.tentWalls;
      if (!cfg) return null;
      const stock = (cfg.stockBaseSell ?? 0) > 0 ? cfg.stockBaseSell! : cfg.baseSell || 0;
      const minBase = Math.min(cfg.baseSell || 0, stock);
      const frame = cfg.frameColorSell ?? 2000;
      const maxAll =
        (cfg.baseSell || 0) +
        (cfg.fullWallBack?.sellDouble || 0) * 2 +
        (cfg.fullWallSide?.sellDouble || 0) * 2 +
        frame;
      if (line.unitPrice + PRICE_TOLERANCE < minBase) return null;
      if (line.unitPrice - PRICE_TOLERANCE > maxAll) return null;
      return line.unitPrice;
    }

    default:
      return null;
  }
}

export function verifyCartLines(
  lines: CartLine[],
  productsById: Map<string, Product>,
): { ok: true; lines: CartLine[] } | { ok: false; error: string } {
  if (lines.length > MAX_LINES) {
    return { ok: false, error: `Objednávka může mít nejvýše ${MAX_LINES} položek.` };
  }

  const out: CartLine[] = [];
  for (const line of lines) {
    if (!line.productId) {
      return { ok: false, error: "Položka košíku je neúplná." };
    }
    if (!Number.isFinite(line.qty) || line.qty < 1 || line.qty > 999) {
      return { ok: false, error: "Neplatné množství u položky." };
    }
    const product = productsById.get(line.productId);
    if (!product || !product.active) {
      return { ok: false, error: `Produkt „${line.name || line.productId}“ už není dostupný.` };
    }

    const expected = catalogUnitPrice(product, line);
    if (expected == null || expected <= 0) {
      return { ok: false, error: `Nepodařilo se ověřit cenu u „${product.name}“.` };
    }
    if (!closeEnough(line.unitPrice, expected)) {
      console.warn("objednavka: price mismatch", {
        productId: product.id,
        submitted: line.unitPrice,
        expected,
      });
      return {
        ok: false,
        error: `Cena u „${product.name}“ nesedí s katalogem. Obnovte stránku a zkuste znovu.`,
      };
    }

    const vatRate = typeof product.vat_rate === "number" ? product.vat_rate : 0.21;
    out.push({
      ...line,
      unitPrice: expected,
      vatRate,
      name: product.name || line.name,
    });
  }
  return { ok: true, lines: out };
}
