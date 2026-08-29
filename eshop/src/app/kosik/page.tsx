"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import { CheckMark, CloseMark, FlagMark } from "@/components/Icons";

export default function CartPage() {
  const { lines, updateQty, removeLine, count } = useCart();
  const router = useRouter();
  const [freeShippingOver, setFreeShippingOver] = useState(0);

  useEffect(() => {
    fetch("/api/checkout-settings")
      .then((r) => r.json())
      .then((s) => setFreeShippingOver(s.shippingFreeOverAmount || 0))
      .catch(() => {});
  }, []);

  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const vat = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);
  const missingToFreeShipping = Math.max(0, freeShippingOver - subtotalEx);

  return (
    <div className="container">
      <div className="page-panel">
      <h1>Košík</h1>

      {lines.length > 0 && freeShippingOver > 0 && (
        <div className="cart-freeship">
          <p>
            {missingToFreeShipping > 0 ? (
              <>
                Do dopravy zdarma chybí <strong>{fmtMoney(missingToFreeShipping)}</strong>.
              </>
            ) : (
              <>
                <CheckMark className="cart-freeship-check" /> Máte dopravu zdarma.
              </>
            )}
          </p>
          <div className="cart-freeship-bar">
            <div
              className="cart-freeship-fill"
              style={{ width: `${Math.min(100, (subtotalEx / freeShippingOver) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="cart-empty">
          <p className="muted">Košík je zatím prázdný.</p>
          <Link href="/#produkty" className="btn-yellow">
            Prohlédnout produkty
          </Link>
        </div>
      ) : (
        <div className="cart-body">
          {lines.map((l) => (
            <div key={l.id} className="cart-line">
              <div className="thumb">
                {l.thumb ? (
                  <Image src={l.thumb} alt={l.name} width={72} height={72} style={{ width: "100%", height: "100%", objectFit: "cover" }} unoptimized />
                ) : (
                  <FlagMark className="thumb-empty" />
                )}
              </div>
              <div className="meta">
                <div className="name">{l.name}</div>
                <div className="sub">
                  {[l.shape ? `Tvar ${l.shape}` : null, l.size, l.note].filter(Boolean).join(" · ") || "—"} ·{" "}
                  {fmtMoney(l.unitPrice)} / ks
                </div>
              </div>
              <div className="qty-row">
                <input
                  type="number"
                  min={1}
                  value={l.qty}
                  onChange={(e) => updateQty(l.id, Number(e.target.value) || 1)}
                  aria-label={`Počet kusů — ${l.name}`}
                />
              </div>
              <div className="cart-line-total">{fmtMoney(l.unitPrice * l.qty)}</div>
              <button className="cart-line-remove" onClick={() => removeLine(l.id)} aria-label={`Odebrat ${l.name}`}>
                <CloseMark className="cart-line-remove-mark" />
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

          <div className="cart-actions">
            <button className="btn-yellow" disabled={count === 0} onClick={() => router.push("/objednavka")}>
              Pokračovat k objednávce
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
