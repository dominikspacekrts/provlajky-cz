"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import { FLAG_SHAPES, FLAG_SIZES, type FlagShape, type FlagSize, type Product } from "@/lib/types";

export default function ProductDetail({ product }: { product: Product }) {
  const { addLine } = useCart();
  const router = useRouter();
  const [shape, setShape] = useState<FlagShape>(FLAG_SHAPES[0]);
  const [size, setSize] = useState<FlagSize>("M");
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const unitPrice = useMemo(() => {
    if (product.kind === "simple") return product.price;
    return product.price_by_size?.[size] ?? 0;
  }, [product, size]);

  const shapeImage = product.kind === "configurable" ? `/shapes/${shape}.jpg` : product.images?.[0];

  function handleAdd() {
    addLine({
      productId: product.id,
      productSlug: product.slug,
      name: product.name,
      type: product.kind === "configurable" ? "flag" : "product",
      shape: product.kind === "configurable" ? shape : null,
      size: product.kind === "configurable" ? size : null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: shapeImage || null,
    });
    setAdded(true);
    setTimeout(() => setAdded(false), 1600);
  }

  return (
    <div className="configurator">
      <div className="config-preview">
        {shapeImage ? (
          <Image src={shapeImage} alt={product.name} width={480} height={600} style={{ width: "100%", height: "100%", objectFit: "contain" }} unoptimized />
        ) : (
          <span style={{ fontSize: 60 }}>🏳️</span>
        )}
      </div>

      <div>
        <h1 style={{ fontSize: 30 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}

        {product.kind === "configurable" && (
          <>
            <div className="option-label">Tvar</div>
            <div className="option-row">
              {FLAG_SHAPES.map((s) => (
                <button key={s} className={`option-chip${shape === s ? " active" : ""}`} onClick={() => setShape(s)}>
                  Tvar {s}
                </button>
              ))}
            </div>

            <div className="option-label">Velikost</div>
            <div className="option-row">
              {FLAG_SIZES.map((s) => (
                <button key={s} className={`option-chip${size === s ? " active" : ""}`} onClick={() => setSize(s)}>
                  {s}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="config-price">
          {fmtMoney(unitPrice)} <span className="vat">bez DPH / ks</span>
        </div>

        <div className="qty-row">
          <span style={{ fontWeight: 600, fontSize: 14 }}>Počet kusů</span>
          <input type="number" min={1} value={qty} onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))} />
        </div>

        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <button className="btn-yellow" disabled={unitPrice <= 0} onClick={handleAdd}>
            {added ? "Přidáno ✓" : "Vložit do košíku"}
          </button>
          <button className="btn-outline" onClick={() => router.push("/kosik")}>
            Přejít do košíku
          </button>
        </div>
        {unitPrice <= 0 && (
          <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 10 }}>
            Pro tuto variantu zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
          </p>
        )}

        {product.description && (
          <p style={{ color: "var(--gray)", marginTop: 24, lineHeight: 1.6, whiteSpace: "pre-line" }}>
            {product.description}
          </p>
        )}
      </div>
    </div>
  );
}
