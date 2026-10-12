"use client";

import { useState, useTransition } from "react";
import { addServiceOrderItem } from "@/lib/actions/orders";
import { serviceLineName } from "@/lib/domain";

type ServiceKind = "shipping" | "design";

export default function AddServiceItemButtons({ orderId }: { orderId: string }) {
  const [kind, setKind] = useState<ServiceKind | null>(null);
  const [price, setPrice] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function open(next: ServiceKind) {
    setKind(next);
    setPrice("");
    setError(null);
  }

  function submit() {
    if (!kind) return;
    const unit = Number(price.replace(",", ".").trim());
    if (!Number.isFinite(unit) || unit < 0) {
      setError("Zadej cenu 0 nebo vyšší.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await addServiceOrderItem(orderId, kind, unit);
        setKind(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Položku se nepodařilo přidat.");
      }
    });
  }

  return (
    <>
      <button className="btn" type="button" onClick={() => open("shipping")}>
        + Doprava
      </button>
      <button className="btn" type="button" onClick={() => open("design")}>
        + Grafický návrh
      </button>
      {kind && (
        <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && !isPending && setKind(null)}>
          <div className="modal">
            <div className="modal-header">
              <h3>Přidat: {serviceLineName(kind)}</h3>
              <button className="modal-close" type="button" onClick={() => setKind(null)}>
                ×
              </button>
            </div>
            <div className="form-col">
              <label>
                Cena bez DPH
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  autoFocus
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submit();
                  }}
                />
              </label>
              <p className="muted" style={{ margin: 0, fontSize: 12 }}>
                1 ks, DPH 21 %. Název, počet i cenu půjde na řádku potom změnit.
              </p>
            </div>
            {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 10 }}>{error}</div>}
            <div className="header-actions" style={{ marginTop: 16 }}>
              <button className="btn primary" type="button" disabled={isPending} onClick={submit}>
                {isPending ? "Přidávám…" : "Přidat"}
              </button>
              <button className="btn" type="button" onClick={() => setKind(null)} disabled={isPending}>
                Zrušit
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
