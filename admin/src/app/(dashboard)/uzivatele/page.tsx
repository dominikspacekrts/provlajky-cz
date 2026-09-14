import { createClient } from "@/lib/supabase/server";
import CustomerActions from "./customer-actions";

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
  password_hash: string | null;
  created_at: string;
};

export default async function UzivatelePage() {
  const supabase = await createClient();
  const { data } = await supabase.from("customers").select("*").order("created_at", { ascending: false });
  const customers = (data || []) as Customer[];
  const usedCount = customers.filter((c) => c.used_at).length;
  const withPassword = customers.filter((c) => c.password_hash).length;

  return (
    <div>
      <h2>Uživatelé</h2>
      <p className="muted">
        Zákazníci z eshopu — slevový kód a volitelně účet s heslem. {customers.length} celkem, {withPassword} s
        heslem, {usedCount} uplatnilo slevu.
      </p>

      {customers.length === 0 ? (
        <p className="muted">Zatím žádní registrovaní zákazníci.</p>
      ) : (
        <div style={{ overflowX: "auto", marginTop: 16 }}>
          <table className="stats-table">
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Jméno</th>
                <th style={{ textAlign: "left" }}>E-mail</th>
                <th style={{ textAlign: "left" }}>Telefon</th>
                <th style={{ textAlign: "left" }}>Kód</th>
                <th>Sleva</th>
                <th style={{ textAlign: "left" }}>Účet</th>
                <th style={{ textAlign: "left" }}>Sleva stav</th>
                <th style={{ textAlign: "left" }}>Registrace</th>
                <th style={{ textAlign: "right" }}>Akce</th>
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
                    {c.password_hash ? (
                      <span className="status-badge status-completed">S heslem</span>
                    ) : (
                      <span className="status-badge status-pending">Jen sleva</span>
                    )}
                  </td>
                  <td style={{ textAlign: "left" }}>
                    {c.used_at ? (
                      <span className="status-badge status-completed">Uplatněno</span>
                    ) : (
                      <span className="status-badge status-pending">Nevyužito</span>
                    )}
                  </td>
                  <td style={{ textAlign: "left" }}>{new Date(c.created_at).toLocaleDateString("cs-CZ")}</td>
                  <td style={{ textAlign: "right" }}>
                    <CustomerActions
                      customerId={c.id}
                      email={c.email}
                      hasPassword={!!c.password_hash}
                      discountUsed={!!c.used_at}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
