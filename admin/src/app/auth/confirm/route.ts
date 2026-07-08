import { type EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Handles Supabase invite/recovery/magic-link e-mails. The Supabase email
// templates are customized (see admin/README setup notes) to link straight
// here with `token_hash`/`type`, instead of Supabase's own /auth/v1/verify
// redirect chain — this is the officially recommended pattern for SSR apps
// because it verifies server-side and works regardless of which device/
// browser opens the e-mail link (no PKCE code_verifier needed).
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });
    if (!error) {
      redirect(next);
    }
  }

  redirect("/login?error=invite-link-expired");
}
