"use client";

// Produkt s volbami (např. těžká základna dle hmotnosti). Uživatel vybere volbu,
// cena se řídí prodejní cenou volby. Jednoduché — bez dopravy a nákladů.

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import type { Product, ProductOption } from "@/lib/types";

export default function OptionsConfigurator({ product }: { product: Product }) {
  const { addLine } = useCart();
  const router = useRouter();

  const options = useMemo<ProductOption[]>(() => product.config?.options ?? [], [product]);
  const [optionId, setOptionId] = useState<string>(options[0]?.id ?? "");
  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const unitPrice = selected?.sellPrice ?? 0;
  const image = product.images?.[0];

  function handleAdd() {
    if (!selected || unitPrice <= 0) return;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      type: "product",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: image || null,
      note: selected.label,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="configurator">
      <div className="config-preview">
        {image ? (
          <Image
            src={image}
            alt={product.name}
            width={520}
            height={620}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized
          />
        ) : (
          <span style={{ fontSize: 60 }}>🧰</span>
        )}
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        {options.length > 1 && (
          <>
            <div className="option-label">Hmotnost / varianta</div>
            <div className="option-row">
              {options.map((o) => (
                <button
                  key={o.id}
                  className={`option-chip${selected?.id === o.id ? " active" : ""}`}
                  onClick={() => setOptionId(o.id)}
                >
                  {o.label}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="config-price">
          {unitPrice > 0 ? (
            <>
              {fmtMoney(unitPrice)} <span className="vat">bez DPH / ks</span>
            </>
          ) : (
            <span style={{ fontSize: 20 }}>Cena na dotaz</span>
          )}
        </div>

        <div className="qty-row">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Počet kusů</span>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
          />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            {added ? "Přidáno ✓" : "Vložit do košíku"}
          </button>
          <button className="btn-outline" onClick={() => router.push("/kosik")}>
            Přejít do košíku
          </button>
        </div>

        {product.description && (
          <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}
