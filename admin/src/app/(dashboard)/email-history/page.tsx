import { createClient } from "@/lib/supabase/server";
import type { EmailHistoryRow } from "@/lib/types";
import EmailHistoryList from "./email-history-list";

export const dynamic = "force-dynamic";

export default async function EmailHistoryPage() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("email_history")
    .select("id, kind, order_id, invoice_id, to_addr, cc, subject, status, sent_at, sent_by")
    .order("sent_at", { ascending: false })
    .limit(300);

  if (error) {
    return <p style={{ color: "#dc2626" }}>Chyba načtení historie: {error.message}</p>;
  }

  const rows = ((data || []) as Omit<EmailHistoryRow, "html_body">[]).map((r) => ({
    ...r,
    html_body: "",
  })) as EmailHistoryRow[];

  return (
    <div>
      <h2>Historie mailů</h2>
      <EmailHistoryList rows={rows} />
    </div>
  );
}
