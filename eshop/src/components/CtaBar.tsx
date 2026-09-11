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

import { STANDARD_VAT_RATE, fmtMoney, withVat } from "@/lib/money";
import { CheckMark } from "@/components/Icons";

export default function CtaBar({
  qty,
  onQtyChange,
  unitPrice,
  vatRate = STANDARD_VAT_RATE,
  disabled = false,
  added = false,
  addLabel = "Vložit do košíku",
  onAdd,
}: {
  qty: number;
  onQtyChange: (next: number) => void;
  unitPrice: number;
  vatRate?: number;
  disabled?: boolean;
  added?: boolean;
  addLabel?: string;
  onAdd: () => void;
}) {
  const hasPrice = unitPrice > 0;
  const totalExVat = unitPrice * qty;

  return (
    <div className="fc-cta">
      <div className="fc-cta-main">
        <div className="fc-cta-price">
          {hasPrice ? (
            <>
              {fmtMoney(withVat(totalExVat, vatRate))}{" "}
              <span className="vat">
                s DPH · {fmtMoney(totalExVat)} bez DPH
                {qty > 1 ? ` · ${qty} × ${fmtMoney(withVat(unitPrice, vatRate))}` : " / ks"}
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
