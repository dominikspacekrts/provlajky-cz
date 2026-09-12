import { createServiceClient } from "@/lib/supabase";
import {
  getSessionCustomerId,
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
  const id = await getSessionCustomerId();
  if (!id) return null;
  return loadCustomerProfile(id);
}
