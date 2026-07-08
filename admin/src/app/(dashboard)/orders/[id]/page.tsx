import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Invoice, Order, OrderItem, SupplierInvoice } from "@/lib/types";
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

  const [{ data: order, error }, { data: items }, { data: invoice }, { data: supplierInvoices }] = await Promise.all([
    supabase.from("orders").select("*").eq("id", id).single(),
    supabase.from("order_items").select("*").eq("order_id", id).order("id"),
    supabase.from("invoices").select("*").eq("order_id", id).eq("kind", "product").maybeSingle(),
    supabase.from("supplier_invoices").select("*").eq("order_id", id).order("date", { ascending: false }),
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
      />
    </div>
  );
}
