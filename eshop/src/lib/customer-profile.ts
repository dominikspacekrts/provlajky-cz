import { createServiceClient } from "@/lib/supabase";
import {
  getSessionPayload,
  type CustomerProfile,
  type ShippingAddressRow,
} from "@/lib/customer-auth";
import type { CustomerAddress } from "@/lib/types";

export async function loadCustomerProfile(customerId: string): Promise<CustomerProfile | null> {
  const supabase = createServiceClient();
  const { data: customer } = await supabase
    .from("customers")
    .select("id, email, name, phone, discount_code, discount_pct, used_at, billing, password_hash")
    .eq("id", customerId)
    .maybeSingle();
  if (!customer) return null;

  const { data: addresses } = await supabase
    .from("customer_shipping_addresses")
    .select("id, customer_id, label, company, name, street, psc, city, created_at")
    .eq("customer_id", customerId)
    .order("created_at", { ascending: true });

  return {
    id: customer.id,
    email: customer.email,
    name: customer.name,
    phone: customer.phone,
    discount_code: customer.discount_code,
    discount_pct: Number(customer.discount_pct) || 0,
    used_at: customer.used_at,
    billing: (customer.billing as CustomerAddress | null) ?? null,
    has_password: !!customer.password_hash,
    shipping_addresses: (addresses || []) as ShippingAddressRow[],
  };
}

export async function getLoggedInProfile(): Promise<CustomerProfile | null> {
  const session = await getSessionPayload();
  if (!session) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customers")
    .select("session_version")
    .eq("id", session.customerId)
    .maybeSingle();

  // Chybějící sloupec (před migrací) = bereme jako verzi 1.
  const dbVersion = data && "session_version" in data ? Number(data.session_version) || 1 : 1;
  if (session.sv !== dbVersion) return null;

  return loadCustomerProfile(session.customerId);
}

export async function bumpSessionVersion(customerId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data: cur } = await supabase
    .from("customers")
    .select("session_version")
    .eq("id", customerId)
    .maybeSingle();
  const next = (Number(cur?.session_version) || 1) + 1;
  await supabase.from("customers").update({ session_version: next }).eq("id", customerId);
  return next;
}

export async function getCustomerSessionVersion(customerId: string): Promise<number> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("customers")
    .select("session_version")
    .eq("id", customerId)
    .maybeSingle();
  return Number(data?.session_version) || 1;
}
