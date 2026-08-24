import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Order, OrderItem, Product, SupplierInvoice } from "@/lib/types";
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

  const [{ data: order, error }, { data: items }, { data: invoice }, { data: supplierInvoices }, { data: products }, { data: discountCustomer }] =
    await Promise.all([
      supabase.from("orders").select("*").eq("id", id).single(),
      supabase.from("order_items").select("*").eq("order_id", id).order("id"),
      supabase.from("invoices").select("*").eq("order_id", id).eq("kind", "product").maybeSingle(),
      supabase.from("supplier_invoices").select("*").eq("order_id", id).order("date", { ascending: false }),
      supabase.from("products").select("*").eq("active", true).order("category").order("sort_order"),
      // Slevový kód použitý na téhle objednávce (pokud nějaký) — customers.used_order_id
      // se nastaví při odeslání objednávky z eshopu, viz /api/objednavka.
      supabase.from("customers").select("email, discount_code").eq("used_order_id", id).maybeSingle(),
    ]);

  if (error || !order) notFound();

  return (
    <div>
      <Link href="/orders" className="back">
        ← Zpět na objednávky
      </Link>
      <OrderDetailClient
        order={order as Order}
        items={(items || []) as OrderItem[]}
        invoice={(invoice as Invoice) || null}
        supplierInvoices={(supplierInvoices || []) as SupplierInvoice[]}
        products={(products || []) as Product[]}
        discountCustomer={discountCustomer as { email: string; discount_code: string } | null}
      />
    </div>
  );
}
