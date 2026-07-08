import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

// Session-aware client (anon key + user's cookies) — respects RLS via is_allowed_user().
// Use this in Server Components / Server Actions for anything that should honor the
// logged-in user's session.
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component without a mutable cookie store — safe to
            // ignore because the proxy (see src/proxy.ts) already refreshes the session.
          }
        },
      },
    }
  );
}

// Service-role client — bypasses RLS entirely. Only ever import this inside
// 'use server' files (Server Actions / Route Handlers), never in client code,
// since it can read/write the SMTP password stored in `settings.mail`.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
