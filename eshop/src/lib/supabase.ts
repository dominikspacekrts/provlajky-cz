import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// Anonymous client — respects RLS. Only ever sees products with active = true
// (see "public can view active products" policy in admin/supabase/schema.sql).
export function createClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Service-role client — bypasses RLS. Only ever import this inside 'use server'
// files (route handlers), never in client code. Used to write orders/order_items
// on behalf of anonymous storefront visitors, who have no allowed_users session.
export function createServiceClient() {
  return createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
