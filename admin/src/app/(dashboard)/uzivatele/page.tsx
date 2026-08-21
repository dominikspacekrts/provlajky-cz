import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Customer = {
  id: string;
  email: string;
  name: string | null;
  phone: string | null;
  discount_code: string;
  discount_pct: number;
  used_at: string | null;
  used_order_id: string | null;
  created_at: string;
};

export default async function UzivatelePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  const customers = (data || []) as Customer[];
  const usedCount = customers.filter((c) => c.used_at).length;

  return (
    <div>
      <h2>Uživatelé</h2>
      <p className="muted">
        Zákazníci zaregistrovaní na eshopu (dev.provlajky.cz) — dostali slevový kód e-mailem.{" "}
        {customers.length} celkem, {usedCount} uplatnilo kód.
      </p>

      {customers.length === 0 ? (
        <p className="muted">Zatím žádní registrovaní zákazníci.</p>
      ) : (
        <table className="stats-table" style={{ marginTop: 16 }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Jméno</th>
              <th style={{ textAlign: "left" }}>E-mail</th>
              <th style={{ textAlign: "left" }}>Telefon</th>
              <th style={{ textAlign: "left" }}>Kód</th>
              <th>Sleva</th>
              <th style={{ textAlign: "left" }}>Stav</th>
              <th style={{ textAlign: "left" }}>Registrace</th>
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id}>
                <td style={{ textAlign: "left" }}>{c.name || "—"}</td>
                <td style={{ textAlign: "left" }}>{c.email}</td>
                <td style={{ textAlign: "left" }}>{c.phone || "—"}</td>
                <td style={{ textAlign: "left", fontFamily: "monospace" }}>{c.discount_code}</td>
                <td>{c.discount_pct} %</td>
                <td style={{ textAlign: "left" }}>
                  {c.used_at ? (
                    <span className="status-badge status-completed">Uplatněno</span>
                  ) : (
                    <span className="status-badge status-pending">Nevyužito</span>
                  )}
                </td>
                <td style={{ textAlign: "left" }}>{new Date(c.created_at).toLocaleDateString("cs-CZ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
