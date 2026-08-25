import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/actions/settings";
import { getOrderCounter } from "@/lib/actions/order-counter";
import type { AllowedUser, Partner } from "@/lib/types";
import SettingsForm from "./settings-form";

export const dynamic = "force-dynamic";
// SMTP connection test can be slow on a first (cold) TLS handshake.
export const maxDuration = 30;

export default async function SettingsPage() {
  const supabase = await createClient();
  const [settings, { data: partners }, { data: allowedUsers }, orderCounter] = await Promise.all([
    getSettings(),
    supabase.from("partners").select("*").order("name"),
    supabase.from("allowed_users").select("*").order("display_name"),
    getOrderCounter(),
  ]);

  return (
    <div>
      <h2>Nastavení</h2>
      <SettingsForm
        settings={settings}
        partners={(partners || []) as Partner[]}
        allowedUsers={(allowedUsers || []) as AllowedUser[]}
        orderCounter={orderCounter}
      />
    </div>
  );
}
