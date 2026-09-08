"use client";

// Spodní lišta konfigurátoru: počet kusů, cena a tlačítko do košíku.
//
// Počet kusů sedí hned napravo od ceny, protože ji přepočítává — když
// byl stepper schovaný nahoře v panelu, zákazník si ho s cenou nespojil.
// Zobrazuje se cena za celé množství; jednotková se přidá do popisku,
// jakmile jsou kusy víc než jeden, ať je pořád jasné, z čeho se počítá.
//
// Sdílí ji všech sedm konfigurátorů — dřív byla lišta v každém zvlášť
// zkopírovaná a rozcházela se.

import { fmtMoney } from "@/lib/money";
import { CheckMark } from "@/components/Icons";

export default function CtaBar({
  qty,
  onQtyChange,
  unitPrice,
  disabled = false,
  added = false,
  addLabel = "Vložit do košíku",
  onAdd,
}: {
  qty: number;
  onQtyChange: (next: number) => void;
  unitPrice: number;
  disabled?: boolean;
  added?: boolean;
  addLabel?: string;
  onAdd: () => void;
}) {
  const hasPrice = unitPrice > 0;

  return (
    <div className="fc-cta">
      <div className="fc-cta-main">
        <div className="fc-cta-price">
          {hasPrice ? (
            <>
              {fmtMoney(unitPrice * qty)}{" "}
              <span className="vat">
                bez DPH {qty > 1 ? `· ${qty} × ${fmtMoney(unitPrice)}` : "/ ks"}
              </span>
            </>
          ) : (
            <span>Cena na dotaz</span>
          )}
        </div>

        <div className="qty-stepper" aria-label="Počet kusů">
          <button type="button" aria-label="Ubrat kus" onClick={() => onQtyChange(Math.max(1, qty - 1))} disabled={qty <= 1}>
            −
          </button>
          <span className="qty-value">{qty}</span>
          <button type="button" aria-label="Přidat kus" onClick={() => onQtyChange(qty + 1)}>
            +
          </button>
        </div>
      </div>

      <button className="btn-yellow" disabled={disabled} onClick={onAdd}>
        {added ? (
          <>
            <CheckMark className="btn-mark" /> Přidáno
          </>
        ) : (
          addLabel
        )}
      </button>
    </div>
  );
}
