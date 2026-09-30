// Jediné místo v aplikaci, které sahá na dataLayer. Komponenty volají jen
// funkce odsud — nikdy nepushují ručně, ať je payload všude stejný.
//
// Bez "use client": mapovací funkce (itemFromProduct) potřebují i server
// komponenty jako výpis kategorie. Pushovací funkce se na serveru jen tiše
// přeskočí, viz kontrola `typeof window`.
//
// Dvě pravidla, která se snadno poruší a pak to agentuře rozbije měření:
//  1) před každým e-commerce eventem musí jít `{ ecommerce: null }`, jinak se
//     položky z předchozího eventu propíšou do dalšího,
//  2) ceny jsou **s DPH** a jako číslo. V DB i v košíku jsou bez DPH
//     (products.price, CartLine.unitPrice), takže se všude přepočítávají.

import { setMetaAdvancedMatching, trackMeta } from "./meta-pixel";
import { PRODUCT_CATEGORIES, type CartLine, type Product, type ProductCategory } from "./types";
import { fromPrice, round2, withVat } from "./money";

const BRAND = "provlajky.cz";
const CURRENCY = "CZK";

export type AnalyticsItem = {
  item_id: string;
  item_name: string;
  item_brand: string;
  item_category: string;
  item_variant?: string;
  price: number;
  quantity: number;
};

function categoryLabel(category: ProductCategory | string | null | undefined) {
  if (!category) return "";
  return PRODUCT_CATEGORIES[category as ProductCategory] ?? String(category);
}

/** Popis konkrétní konfigurace („300×80 cm | pvc") pro item_variant.
 *  Poznámka položky se schválně nepoužívá — opakuje rozměr i materiál a je
 *  psaná pro výrobu, ne pro statistiku. */
function variantLabel(line: CartLine) {
  const size = line.widthCm && line.heightCm ? `${line.widthCm}×${line.heightCm} cm` : line.size;
  return [size, line.shape, line.material].filter(Boolean).join(" | ") || undefined;
}

export function itemFromCartLine(line: CartLine): AnalyticsItem {
  return {
    item_id: line.productSlug || line.productId,
    item_name: line.name,
    item_brand: BRAND,
    item_category: categoryLabel(line.productCategory),
    item_variant: variantLabel(line),
    price: withVat(line.unitPrice, line.vatRate),
    quantity: line.qty,
  };
}

export function itemFromProduct(product: Product, index?: number): AnalyticsItem & { index?: number } {
  return {
    item_id: product.slug,
    item_name: product.name,
    item_brand: BRAND,
    item_category: categoryLabel(product.category),
    price: withVat(fromPrice(product) ?? 0, product.vat_rate),
    quantity: 1,
    ...(typeof index === "number" ? { index } : {}),
  };
}

function itemsValue(items: AnalyticsItem[]) {
  return round2(items.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

type EcommercePayload = Record<string, unknown>;

function pushEcommerce(event: string, ecommerce: EcommercePayload, extra?: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ...extra, ecommerce: { currency: CURRENCY, ...ecommerce } });
}

function metaProductParams(items: AnalyticsItem[], value: number) {
  const params: Record<string, unknown> = {
    content_type: "product",
    content_ids: items.map((item) => item.item_id).filter(Boolean),
    contents: items.map((item) => ({ id: item.item_id, quantity: item.quantity, item_price: item.price })),
    value,
    currency: CURRENCY,
    num_items: items.reduce((sum, item) => sum + (item.quantity || 0), 0),
  };
  if (items.length === 1) {
    params.content_name = items[0].item_name;
    if (items[0].item_category) params.content_category = items[0].item_category;
  }
  return params;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : "";
}

export function trackViewItemList(items: AnalyticsItem[], listName: string) {
  pushEcommerce("view_item_list", { item_list_name: listName, items });
}

export function trackSelectItem(item: AnalyticsItem, listName: string) {
  pushEcommerce("select_item", { item_list_name: listName, items: [item] });
}

export function trackViewItem(item: AnalyticsItem) {
  const value = itemsValue([item]);
  pushEcommerce("view_item", { value, items: [item] });
  trackMeta("ViewContent", metaProductParams([item], value));
}

export function trackAddToCart(item: AnalyticsItem) {
  const value = itemsValue([item]);
  pushEcommerce("add_to_cart", { value, items: [item] });
  trackMeta("AddToCart", metaProductParams([item], value));
}

export function trackRemoveFromCart(item: AnalyticsItem) {
  pushEcommerce("remove_from_cart", { value: itemsValue([item]), items: [item] });
}

export function trackViewCart(items: AnalyticsItem[]) {
  pushEcommerce("view_cart", { value: itemsValue(items), items });
}

export function trackBeginCheckout(items: AnalyticsItem[]) {
  const value = itemsValue(items);
  pushEcommerce("begin_checkout", { value, items });
  trackMeta("InitiateCheckout", metaProductParams(items, value));
}

export function trackAddShippingInfo(items: AnalyticsItem[], shippingTier: string) {
  pushEcommerce("add_shipping_info", { value: itemsValue(items), shipping_tier: shippingTier, items });
}

export function trackAddPaymentInfo(items: AnalyticsItem[], paymentType: string) {
  const value = itemsValue(items);
  pushEcommerce("add_payment_info", { value, payment_type: paymentType, items });
  trackMeta("AddPaymentInfo", metaProductParams(items, value));
}

export type PurchasePayload = {
  transaction_id: string;
  value: number;
  tax: number;
  shipping: number;
  coupon: string;
  items: AnalyticsItem[];
  user_data?: Record<string, unknown>;
};

export function trackPurchase(payload: PurchasePayload) {
  const { user_data, ...ecommerce } = payload;
  const eventId = `purchase_${payload.transaction_id}`;
  pushEcommerce(
    "purchase",
    { ...ecommerce },
    {
      // Stejné ID posílá i Conversions API, Meta oba hity sloučí.
      event_id: eventId,
      ...(user_data ? { user_data } : {}),
    }
  );

  const user = asRecord(user_data);
  const address = asRecord(user?.address);
  if (user) {
    setMetaAdvancedMatching({
      em: asString(user.email),
      ph: asString(user.phone_number),
      fn: asString(address?.first_name),
      ln: asString(address?.last_name),
      ct: asString(address?.city),
      zp: asString(address?.postal_code),
      country: asString(address?.country) || "cz",
    });
  }
  trackMeta("Purchase", { ...metaProductParams(payload.items, payload.value), order_id: payload.transaction_id }, eventId);
}

export function trackGenerateLead(formName: string) {
  if (typeof window === "undefined") return;
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: "generate_lead", form_name: formName, currency: CURRENCY });
  trackMeta("Lead");
}
