"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { fmtMoney } from "@/lib/money";
import { type Product } from "@/lib/types";
import FlagConfigurator from "./FlagConfigurator";

export default function ProductDetail({ product }: { product: Product }) {
  if (product.kind === "configurable") return <FlagConfigurator product={product} />;
  return <SimpleProductDetail product={product} />;
}

function SimpleProductDetail({ product }: { product: Product }) {
  const { addLine } = useCart();
  const router = useRouter();
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);

  const unitPrice = useMemo(() => product.price, [product]);
  const shapeImage = product.images?.[0];

  function handleAdd() {
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
