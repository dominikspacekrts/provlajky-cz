import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase";
import { PRODUCT_CATEGORIES, type CustomerAddress, type ProductCategory } from "@/lib/types";

// Podklad pro event `purchase` na děkovací stránce. Čte se výhradně z uložené
// objednávky, ne z košíku v prohlížeči — po odeslání je košík prázdný a hlavně
// ceny dopravy, slevu i DPH dopočítává server.
//
// Odpověď obsahuje osobní údaje (Enhanced Conversions), takže se vydá jen
// **do dvou hodin od založení objednávky**. Na děkovací stránku se zákazník
// dostane hned, útočník s odhadnutým UUID později už nic nezíská.
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function round2(value: number) {
  return Math.round((Number.isFinite(value) ? value : 0) * 100) / 100;
}

function splitName(full: string | undefined | null) {
  const parts = (full || "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first_name: "", last_name: "" };
  return { first_name: parts[0], last_name: parts.slice(1).join(" ") };
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Neplatné ID objednávky." }, { status: 404 });

  const supabase = createServiceClient();
  const { data: order } = await supabase
    .from("orders")
    .select("id, order_number, created_at, discount_pct, shipping, ship_vat_rate, customer")
    .eq("id", id)
    .maybeSingle();

  if (!order) return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });

  const age = Date.now() - new Date(order.created_at).getTime();
  if (!Number.isFinite(age) || age > MAX_AGE_MS) {
    return NextResponse.json({ error: "Objednávka nenalezena." }, { status: 404 });
  }

  const { data: itemRows } = await supabase
    .from("order_items")
    .select("product_id, wc_line_name, qty, unit_price, vat_rate, size, shape, material, width_cm, height_cm")
    .eq("order_id", id);
  const items = itemRows || [];

  // Slug a kategorie se dohledávají v products — item_id musí sedět s g:id
  // v produktovém feedu, a to je slug, ne UUID.
  const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))] as string[];
  const productById = new Map<string, { slug: string; category: string; name: string }>();
  if (productIds.length) {
    const { data: products } = await supabase.from("products").select("id, slug, category, name").in("id", productIds);
    for (const p of products || []) productById.set(p.id, p);
  }

  // Slevový kód se spotřebovává v customers.used_order_id (viz POST výše).
  const { data: couponRow } = await supabase
    .from("customers")
    .select("discount_code")
    .eq("used_order_id", id)
    .maybeSingle();

  // Stejná matematika jako admin/src/lib/domain.ts computeOrderTotals:
  // sleva se vztahuje jen na zboží, ne na dopravu.
  const discountPct = order.discount_pct || 0;
  const afterDiscount = (value: number) => (discountPct ? value * (1 - discountPct / 100) : value);

  let productEx = 0;
  let productVat = 0;
  const analyticsItems = items.map((item) => {
    const lineEx = (item.unit_price || 0) * (item.qty || 0);
    const vatRate = item.vat_rate != null ? item.vat_rate : 0.21;
    productEx += lineEx;
    productVat += lineEx * vatRate;

    const product = item.product_id ? productById.get(item.product_id) : undefined;
    const size =
      item.width_cm && item.height_cm ? `${item.width_cm}×${item.height_cm} cm` : item.size || null;
    return {
      item_id: product?.slug || item.product_id || "",
      item_name: product?.name || item.wc_line_name || "",
      item_brand: "provlajky.cz",
      item_category: product ? PRODUCT_CATEGORIES[product.category as ProductCategory] ?? product.category : "",
      item_variant: [size, item.shape, item.material].filter(Boolean).join(" | ") || undefined,
      price: round2((item.unit_price || 0) * (1 + vatRate)),
      quantity: item.qty || 0,
    };
  });

  const shippingEx = order.shipping || 0;
  const shippingVatRate = order.ship_vat_rate != null ? order.ship_vat_rate : 0.21;

  const billing = (order.customer as { billing?: CustomerAddress } | null)?.billing;
  const { first_name, last_name } = splitName(billing?.name || billing?.company);

  return NextResponse.json(
    {
      transaction_id: order.order_number ? String(order.order_number) : order.id,
      // Hodnota je zboží s DPH po slevě, bez dopravy — dopravu nese vlastní pole.
      value: round2(afterDiscount(productEx + productVat)),
      tax: round2(afterDiscount(productVat)),
      shipping: round2(shippingEx * (1 + shippingVatRate)),
      coupon: couponRow?.discount_code || "",
      items: analyticsItems,
      user_data: {
        email: billing?.email || "",
        phone_number: billing?.phone || "",
        address: {
          first_name,
          last_name,
          city: billing?.city || "",
          postal_code: billing?.psc || "",
          country: "CZ",
        },
      },
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
