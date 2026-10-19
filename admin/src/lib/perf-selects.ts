// Úzké SELECT řetězce — `select("*")` tahá base64 (images, file_data, fullArtwork)
// a nafukuje RSC payload o megabajty.

import type { Design, OrderItem } from "@/lib/types";

/** Produkty bez images[] (data-URL fotek). */
export const PRODUCT_CORE_SELECT =
  "id, slug, category, name, subtitle, description, kind, price, price_by_size, vat_rate, active, sort_order, sale_pct, config, partner_ids, created_at, updated_at";

/** Dodavatelské faktury bez PDF/base64. */
export const SUPPLIER_INVOICE_LIST_SELECT =
  "id, order_id, supplier, invoice_num, date, amount, exchange_rate, amount_czk, filename, created_at";

/** Seznam objednávek — jen to, co karty a součty potřebují. */
export const ORDER_LIST_SELECT =
  "id, order_number, title, status, customer, created_at, currency, supplier_paid, discount_pct, shipping, ship_vat_rate";

export const ORDER_LIST_ITEMS_SELECT = "id, unit_price, qty, vat_rate, material, wc_line_name";

const MAX_INLINE_SRC = 80_000; // ~80 KB — thumb necháme, obří fullArtwork/logo vyhodíme

function slimSrc(src: string | null | undefined): string | null {
  if (!src) return null;
  if (src.startsWith("data:") && src.length > MAX_INLINE_SRC) return null;
  return src;
}

export function slimDesign(d: Design | null | undefined): Design | null {
  if (!d) return null;
  return {
    ...d,
    thumb: slimSrc(d.thumb),
    logo: d.logo ? { ...d.logo, src: slimSrc(d.logo.src) || "" } : d.logo,
    // Zachová geometrii (editor ví, že něco bylo), bez megabajtového src.
    fullArtwork: d.fullArtwork ? { ...d.fullArtwork, src: slimSrc(d.fullArtwork.src) || "" } : d.fullArtwork,
  };
}

export function slimOrderItem(it: OrderItem): OrderItem {
  return {
    ...it,
    artwork_images: [],
    artwork_files: [],
    design: slimDesign(it.design),
    multi_artwork: it.multi_artwork?.map((d) => slimDesign(d)!) ?? null,
  };
}
