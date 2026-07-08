"use server";

// One-time importer for the JSON file produced by the old app's "Exportovat vše
// (JSON)" button (Nastavení → Export dat). Reads the old camelCase shape and
// upserts it into the new Postgres schema, keyed by `legacy_id` so re-running
// the import after a partial failure is safe.
import { createClient } from "@/lib/supabase/server";

type LegacyBilling = Record<string, unknown>;
type LegacyDesign = Record<string, unknown> & { thumb?: string; sleeveColor?: string; flagBounds?: unknown };

type LegacyItem = {
  id: string;
  type?: "flag" | "banner";
  shape?: string | null;
  size?: string | null;
  widthCm?: number | null;
  heightCm?: number | null;
  qty: number;
  unitPrice: number;
  vatRate: number;
  wcLineName?: string;
  wcProductId?: number | string;
  artworkImages?: string[];
  artworkFiles?: string[];
  design?: LegacyDesign | null;
  designs?: LegacyDesign[] | null;
};

type LegacySupplierInvoice = {
  id: string;
  filename?: string | null;
  fileData?: string | null;
  amountEur: number;
  rate?: number | null;
  rateDate?: string | null;
  date: string | number;
  amountCzk?: number | null;
  source?: string | null;
};

type LegacyOrder = {
  id: string;
  wcId?: number | string | null;
  orderNumber?: string;
  title?: string;
  status: string;
  currency?: "CZK" | "EUR";
  foreign?: boolean;
  shipping?: number;
  shipVatRate?: number;
  discountPct?: number;
  customer: { billing: LegacyBilling; shipping: LegacyBilling };
  items: LegacyItem[];
  createdAt?: number;
  _dirty?: boolean;
  supplierPaid?: boolean;
  supplierInvoices?: LegacySupplierInvoice[];
};

type LegacyInvoice = {
  id: string;
  number: string;
  kind?: "product" | "payout";
  orderId?: string;
  orderNumber?: string;
  payoutId?: string;
  issued?: number;
  taxDate?: number;
  due?: number;
  paid?: boolean;
  currency?: string;
  foreign?: boolean;
  customer?: LegacyBilling;
  shipping_customer?: Record<string, string>;
  items?: unknown[];
  discountPct?: number;
  shipping?: number;
  shipVatRate?: number;
  totals?: unknown;
  supplier?: unknown;
  subject?: string;
  amount?: number;
};

type LegacyPayout = { id: string; partnerId: string; partnerName?: string; amount: number; date: number };

type LegacySettings = {
  costPerSize?: { S: number; M: number; L: number; XL: number };
  partners?: { id: string; name: string; share: number; billing: LegacyBilling }[];
  mail?: Record<string, unknown>;
};

export type LegacyExport = {
  exportedAt?: string;
  orders: LegacyOrder[];
  invoices: LegacyInvoice[];
  payouts: LegacyPayout[];
  settings: LegacySettings;
};

export type MigrationSummary = Record<string, { ok: number; failed: number; error?: string }>;

const isoDate = (ms?: number | null) => (ms ? new Date(ms).toISOString().slice(0, 10) : null);

export async function runMigrationImport(data: LegacyExport): Promise<MigrationSummary> {
  const supabase = await createClient();
  const summary: MigrationSummary = {};

  // 1) partners (PK = legacy string id, e.g. 'alex' / 'dominik')
  try {
    const partners = data.settings?.partners || [];
    if (partners.length) {
      const { error } = await supabase
        .from("partners")
        .upsert(partners.map((p) => ({ id: p.id, name: p.name, share: p.share, billing: p.billing || {} })), {
          onConflict: "id",
        });
      if (error) throw error;
    }
    summary.partners = { ok: partners.length, failed: 0 };
  } catch (e) {
    summary.partners = { ok: 0, failed: 1, error: e instanceof Error ? e.message : String(e) };
  }

  // 2) settings singleton
  try {
    const { error } = await supabase
      .from("settings")
      .update({
        cost_per_size: data.settings?.costPerSize || { S: 0, M: 0, L: 0, XL: 0 },
        mail: data.settings?.mail || {},
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
    if (error) throw error;
    summary.settings = { ok: 1, failed: 0 };
  } catch (e) {
    summary.settings = { ok: 0, failed: 1, error: e instanceof Error ? e.message : String(e) };
  }

  // 3) orders + order_items + per-order supplier invoices
  const orderIdMap = new Map<string, string>(); // legacy order id -> new uuid
  let ordersOk = 0,
    ordersFailed = 0,
    itemsOk = 0,
    itemsFailed = 0,
    supInvOk = 0,
    supInvFailed = 0;
  for (const o of data.orders || []) {
    try {
      const { data: inserted, error } = await supabase
        .from("orders")
        .upsert(
          {
            legacy_id: o.id,
            wc_id: o.wcId != null ? String(o.wcId) : null,
            order_number: o.orderNumber || null,
            title: o.title || null,
            status: o.status || "pending",
            currency: o.currency || "CZK",
            is_foreign: !!o.foreign,
            shipping: o.shipping || 0,
            ship_vat_rate: o.shipVatRate != null ? o.shipVatRate : 0.21,
            discount_pct: o.discountPct || 0,
            customer: o.customer || { billing: {}, shipping: {} },
            created_at: o.createdAt ? new Date(o.createdAt).toISOString() : new Date().toISOString(),
            dirty: !!o._dirty,
            supplier_paid: !!o.supplierPaid,
          },
          { onConflict: "legacy_id" }
        )
        .select("id, legacy_id")
        .single();
      if (error) throw error;
      orderIdMap.set(o.id, inserted.id);
      ordersOk++;

      for (const it of o.items || []) {
        try {
          const { error: itemErr } = await supabase.from("order_items").upsert(
            {
              legacy_id: it.id,
              order_id: inserted.id,
              type: it.type || "flag",
              shape: it.shape ?? null,
              size: it.size ?? null,
              width_cm: it.widthCm ?? null,
              height_cm: it.heightCm ?? null,
              qty: it.qty || 1,
              unit_price: it.unitPrice || 0,
              vat_rate: it.vatRate != null ? it.vatRate : 0.21,
              wc_line_name: it.wcLineName || null,
              wc_product_id: it.wcProductId != null ? String(it.wcProductId) : null,
              artwork_images: it.artworkImages || [],
              artwork_files: it.artworkFiles || [],
              design: it.design || null,
              multi_artwork: it.designs || null,
            },
            { onConflict: "legacy_id" }
          );
          if (itemErr) throw itemErr;
          itemsOk++;
        } catch {
          itemsFailed++;
        }
      }

      for (const si of o.supplierInvoices || []) {
        try {
          const { error: siErr } = await supabase.from("supplier_invoices").upsert(
            {
              legacy_id: si.id,
              order_id: inserted.id,
              date: isoDate(typeof si.date === "number" ? si.date : Date.parse(si.date)) || new Date().toISOString().slice(0, 10),
              amount: si.amountEur,
              amount_czk: si.amountCzk ?? null,
              exchange_rate: si.rate ?? null,
              filename: si.filename ?? null,
              file_data: si.fileData ?? null,
            },
            { onConflict: "legacy_id" }
          );
          if (siErr) throw siErr;
          supInvOk++;
        } catch {
          supInvFailed++;
        }
      }
    } catch {
      ordersFailed++;
    }
  }
  summary.orders = { ok: ordersOk, failed: ordersFailed };
  summary.order_items = { ok: itemsOk, failed: itemsFailed };
  summary.supplier_invoices = { ok: supInvOk, failed: supInvFailed };

  // 4) payouts (must exist before invoices, since invoices.payout_id references them)
  const payoutIdMap = new Map<string, string>();
  let payoutsOk = 0,
    payoutsFailed = 0;
  for (const p of data.payouts || []) {
    try {
      const { data: inserted, error } = await supabase
        .from("payouts")
        .upsert(
          {
            legacy_id: p.id,
            partner_id: p.partnerId,
            partner_name: p.partnerName || null,
            amount: p.amount,
            date: isoDate(p.date) || new Date().toISOString().slice(0, 10),
          },
          { onConflict: "legacy_id" }
        )
        .select("id")
        .single();
      if (error) throw error;
      payoutIdMap.set(p.id, inserted.id);
      payoutsOk++;
    } catch {
      payoutsFailed++;
    }
  }
  summary.payouts = { ok: payoutsOk, failed: payoutsFailed };

  // 5) invoices (product + payout kind)
  let invOk = 0,
    invFailed = 0;
  for (const inv of data.invoices || []) {
    try {
      const isPayout = inv.kind === "payout";
      const { error } = await supabase.from("invoices").upsert(
        {
          legacy_id: inv.id,
          kind: isPayout ? "payout" : "product",
          number: inv.number,
          order_id: inv.orderId ? orderIdMap.get(inv.orderId) || null : null,
          order_number: inv.orderNumber || null,
          payout_id: inv.payoutId ? payoutIdMap.get(inv.payoutId) || null : null,
          issued: isoDate(inv.issued) || new Date().toISOString().slice(0, 10),
          tax_date: isoDate(inv.taxDate),
          due: isoDate(inv.due),
          paid: !!inv.paid,
          currency: inv.currency || "CZK",
          is_foreign: !!inv.foreign,
          customer: isPayout ? null : inv.customer || null,
          shipping_customer: isPayout ? null : inv.shipping_customer || null,
          items: isPayout ? [] : inv.items || [],
          discount_pct: inv.discountPct || 0,
          shipping: inv.shipping || 0,
          ship_vat_rate: inv.shipVatRate != null ? inv.shipVatRate : 0.21,
          totals: isPayout ? null : inv.totals || null,
          supplier: isPayout ? inv.supplier || null : null,
          payout_customer: isPayout ? inv.customer || null : null,
          subject: isPayout ? inv.subject || null : null,
          amount: isPayout ? inv.amount || null : null,
        },
        { onConflict: "legacy_id" }
      );
      if (error) throw error;
      invOk++;
    } catch {
      invFailed++;
    }
  }
  summary.invoices = { ok: invOk, failed: invFailed };

  return summary;
}
