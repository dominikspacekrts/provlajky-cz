import { createServiceClient } from "./supabase";
import type { CheckoutSettings } from "./types";

const DEFAULT: CheckoutSettings = { shippingFreeOverAmount: 0, shippingMethods: [], paymentMethods: [] };

// Způsoby dopravy/platby nastavené v adminu (Nastavení → Doprava a platby) —
// settings.shipping/payment je čitelné jen pro přihlášené adminy (RLS), takže
// tu musí jít service-role klient; nikdy nic z tohohle souboru neimportuj do
// klientské komponenty (viz /api/checkout-settings pro veřejné API).
export async function getCheckoutSettings(): Promise<CheckoutSettings> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.from("settings").select("shipping, payment").eq("id", 1).single();
    if (error || !data) return DEFAULT;
    const shipping = data.shipping as { freeOverAmount?: number; methods?: CheckoutSettings["shippingMethods"] } | null;
    const payment = data.payment as { methods?: CheckoutSettings["paymentMethods"] } | null;
    return {
      shippingFreeOverAmount: shipping?.freeOverAmount ?? DEFAULT.shippingFreeOverAmount,
      shippingMethods: shipping?.methods ?? DEFAULT.shippingMethods,
      paymentMethods: payment?.methods ?? DEFAULT.paymentMethods,
    };
  } catch {
    // shipping/payment sloupce ještě nemusí existovat (migrace neproběhla).
    return DEFAULT;
  }
}
