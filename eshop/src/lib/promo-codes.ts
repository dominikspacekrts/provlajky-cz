import type { SupabaseClient } from "@supabase/supabase-js";

export type PromoRow = {
  id: string;
  code: string;
  discount_type: "percent" | "fixed";
  discount_value: number;
  one_shot: boolean;
  max_uses: number | null;
  used_count: number;
  valid_until: string | null;
};

export type ResolvedDiscount =
  | {
      source: "promo";
      promoId: string;
      /** Procento aplikované na order.discount_pct */
      discountPct: number;
      /** Informace pro UI (bez zbývajících použití). */
      message: string;
    }
  | {
      source: "customer";
      customerId: string;
      discountPct: number;
      message: string;
    };

function fmtValidUntil(iso: string | null): string {
  if (!iso) return "";
  return ` Platí do ${new Date(iso).toLocaleDateString("cs-CZ")}.`;
}

function isExpired(validUntil: string | null): boolean {
  if (!validUntil) return false;
  return new Date(validUntil).getTime() < Date.now();
}

function isExhausted(p: PromoRow): boolean {
  if (p.one_shot && p.used_count >= 1) return true;
  if (p.max_uses != null && p.used_count >= p.max_uses) return true;
  return false;
}

/**
 * Ověří promo_codes, případně customers.discount_code.
 * `subtotalEx` je potřeba u fixed slevy (přepočet na %).
 */
export async function resolveDiscountCode(
  supabase: SupabaseClient,
  rawCode: string,
  subtotalEx = 0
): Promise<{ ok: true; discount: ResolvedDiscount } | { ok: false; message: string; status?: number }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, message: "Zadejte slevový kód." };

  const { data: promo, error: promoErr } = await supabase
    .from("promo_codes")
    .select("id, code, discount_type, discount_value, one_shot, max_uses, used_count, valid_until")
    .eq("code", code)
    .maybeSingle();

  if (promoErr) {
    console.error("resolveDiscountCode: promo lookup failed", promoErr);
    return { ok: false, message: "Kód se teď nepodařilo ověřit.", status: 500 };
  }

  if (promo) {
    const p = promo as PromoRow;
    if (isExpired(p.valid_until)) {
      return { ok: false, message: "Slevový kód už vypršel." };
    }
    if (isExhausted(p)) {
      return { ok: false, message: "Slevový kód už byl použitý." };
    }

    let discountPct = 0;
    let message = "";
    if (p.discount_type === "fixed") {
      const amount = Number(p.discount_value) || 0;
      if (subtotalEx > 0) {
        discountPct = Math.min(100, (amount / subtotalEx) * 100);
      } else {
        // Při validate bez košíku vrátíme 0 % a zprávu o pevné částce —
        // checkout dopočítá z reálného mezisoučtu.
        discountPct = 0;
      }
      message = `Sleva ${Math.round(amount).toLocaleString("cs-CZ")} Kč bude odečtena z mezisoučtu.${fmtValidUntil(p.valid_until)}`;
    } else {
      discountPct = Number(p.discount_value) || 0;
      message = `Sleva ${discountPct} % bude odečtena z mezisoučtu.${fmtValidUntil(p.valid_until)}`;
    }

    return {
      ok: true,
      discount: { source: "promo", promoId: p.id, discountPct, message },
    };
  }

  const { data: customer, error: custErr } = await supabase
    .from("customers")
    .select("id, discount_pct, used_at")
    .eq("discount_code", code)
    .maybeSingle();

  if (custErr) {
    console.error("resolveDiscountCode: customer lookup failed", custErr);
    return { ok: false, message: "Kód se teď nepodařilo ověřit.", status: 500 };
  }
  if (!customer) return { ok: false, message: "Slevový kód je neplatný." };
  if (customer.used_at) return { ok: false, message: "Slevový kód už byl použitý." };

  const discountPct = Number(customer.discount_pct) || 0;
  return {
    ok: true,
    discount: {
      source: "customer",
      customerId: customer.id,
      discountPct,
      message: `Sleva ${discountPct} % bude odečtena z mezisoučtu.`,
    },
  };
}

/** Atomické spotřebování promo kódu. Vrací false, pokud mezitím vypršel / došel. */
export async function claimPromoCode(
  supabase: SupabaseClient,
  promoId: string,
  orderId: string
): Promise<boolean> {
  const { data: row } = await supabase
    .from("promo_codes")
    .select("id, one_shot, max_uses, used_count, valid_until")
    .eq("id", promoId)
    .maybeSingle();
  if (!row) return false;
  const p = row as PromoRow;
  if (isExpired(p.valid_until) || isExhausted(p)) return false;

  const nextCount = (p.used_count || 0) + 1;
  if (p.one_shot && nextCount > 1) return false;
  if (p.max_uses != null && nextCount > p.max_uses) return false;

  const { data: updated } = await supabase
    .from("promo_codes")
    .update({ used_count: nextCount, last_used_order_id: orderId })
    .eq("id", promoId)
    .eq("used_count", p.used_count)
    .select("id")
    .maybeSingle();

  return !!updated;
}
