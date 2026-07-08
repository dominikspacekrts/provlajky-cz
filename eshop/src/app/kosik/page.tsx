"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";

export default function CartPage() {
  const { lines, updateQty, removeLine, count } = useCart();
  const router = useRouter();

  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const vat = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);

  return (
    <div className="container" style={{ paddingTop: 40, paddingBottom: 60 }}>
      <h1 style={{ fontSize: 30 }}>Košík</h1>

      {lines.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <p style={{ color: "var(--gray)" }}>Košík je zatím prázdný.</p>
          <Link href="/" className="btn-yellow" style={{ marginTop: 12, display: "inline-flex" }}>
            Prohlédnout produkty
          </Link>
        </div>
      ) : (
        <div style={{ marginTop: 24, maxWidth: 720 }}>
          {lines.map((l) => (
            <div key={l.id} className="cart-line">
              <div className="thumb">
                {l.thumb ? (
                  <Image src={l.thumb} alt={l.name} width={72} height={72} style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
                ) : (
                  <span style={{ fontSize: 24 }}>🏳️</span>
                )}
              </div>
              <div className="meta">
                <div className="name">{l.name}</div>
                <div className="sub">
                  {[l.shape ? `Tvar ${l.shape}` : null, l.size].filter(Boolean).join(" · ") || "—"} ·{" "}
                  {fmtMoney(l.unitPrice)} / ks
                </div>
              </div>
              <input
                type="number"
                min={1}
                value={l.qty}
                onChange={(e) => updateQty(l.id, Number(e.target.value) || 1)}
                style={{ width: 60, padding: 8, border: "1.5px solid var(--border)", borderRadius: 8, textAlign: "center" }}
              />
              <div style={{ minWidth: 90, textAlign: "right", fontWeight: 700 }}>{fmtMoney(l.unitPrice * l.qty)}</div>
              <button
                onClick={() => removeLine(l.id)}
                style={{ border: "none", background: "#fee2e2", color: "#991b1b", borderRadius: 8, width: 32, height: 32, cursor: "pointer" }}
                aria-label="Odebrat"
              >
                ×
              </button>
            </div>
          ))}

          <div className="cart-summary">
            <div className="row">
              <span>Mezisoučet bez DPH</span>
              <span>{fmtMoney(subtotalEx)}</span>
            </div>
            <div className="row">
              <span>DPH</span>
              <span>{fmtMoney(vat)}</span>
            </div>
            <div className="row total">
              <span>Celkem</span>
              <span>{fmtMoney(subtotalEx + vat)}</span>
            </div>
          </div>

          <div style={{ marginTop: 20, display: "flex", justifyContent: "flex-end" }}>
            <button className="btn-yellow" disabled={count === 0} onClick={() => router.push("/objednavka")}>
              Pokračovat k objednávce
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
