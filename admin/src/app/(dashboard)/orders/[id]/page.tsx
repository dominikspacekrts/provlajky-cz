import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/actions/settings";
import { loadProductSuppliers } from "@/lib/actions/products";
import { PRODUCT_CORE_SELECT, SUPPLIER_INVOICE_LIST_SELECT, slimOrderItem } from "@/lib/perf-selects";
import type { Invoice, Order, OrderItem, Partner, Product, Review, SupplierInvoice } from "@/lib/types";
import OrderDetailClient from "./order-detail-client";

export const dynamic = "force-dynamic";
// PDF generation (fetches a font from a CDN) + SMTP send can take longer than
// Vercel's default 10s function timeout on the Hobby plan — give it headroom.
export const maxDuration = 60;

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const [{ data: order, error }, { data: items }, { data: invoice }, { data: supplierInvoices }, { data: products }, { data: partners }, { data: discountCustomer }, settings, productSuppliers, { data: review }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id).order("id"),
      // Bez vnořených thumb data-URL v items — stačí číslo/stav pro UI.
      supabase.from("invoices").select("id, number, kind, order_id, issued, due, paid, currency, totals").eq("order_id", id).eq("kind", "product").maybeSingle(),
      supabase
        .from("supplier_invoices")
        .select(SUPPLIER_INVOICE_LIST_SELECT)
        .eq("order_id", id)
        .order("date", { ascending: false }),
      // Bez images[] (base64) — marže/add-item potřebují config/ceny, ne fotky.
      supabase.from("products").select(PRODUCT_CORE_SELECT).order("category").order("sort_order"),
      supabase.from("partners").select("*").order("name"),
      supabase.from("customers").select("email, discount_code").eq("used_order_id", id).maybeSingle(),
      getSettings(),
      loadProductSuppliers(),
      supabase.from("reviews").select("status, rating").eq("order_id", id).maybeSingle(),
    ]);

  if (error || !order) notFound();

  const slimItems = ((items || []) as OrderItem[]).map(slimOrderItem);
  const productsWithEmptyImages = ((products || []) as Omit<Product, "images">[]).map((p) => ({
    ...p,
    images: [] as string[],
  })) as Product[];

  return (
    <div>
      <Link href="/orders" className="back">
        ← Zpět na objednávky
      </Link>
      <OrderDetailClient
        order={order as Order}
        items={slimItems}
        invoice={(invoice as Invoice) || null}
        supplierInvoices={(supplierInvoices || []) as SupplierInvoice[]}
        products={productsWithEmptyImages}
        partners={(partners || []) as Partner[]}
        discountCustomer={discountCustomer as { email: string; discount_code: string } | null}
        costPerSize={settings.cost_per_size}
        productSuppliers={productSuppliers}
        review={review as Pick<Review, "status" | "rating"> | null}
      />
    </div>
  );
}
