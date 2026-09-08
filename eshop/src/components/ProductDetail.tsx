"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { type Product } from "@/lib/types";
import FlagConfigurator from "./FlagConfigurator";
import BannerConfigurator from "./BannerConfigurator";
import VariantConfigurator from "./VariantConfigurator";
import OptionsConfigurator from "./OptionsConfigurator";
import CustomFlagConfigurator from "./CustomFlagConfigurator";
import TentWallsConfigurator from "./TentWallsConfigurator";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";
import { FlagMark } from "@/components/Icons";

export default function ProductDetail({
  product,
  size,
  galleryPhotos,
}: {
  product: Product;
  size?: string;
  galleryPhotos?: { id: string; image: string }[];
}) {
  if (product.kind === "configurable") return <FlagConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "custom_flag") return <CustomFlagConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "banner_m2") return <BannerConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "variant") return <VariantConfigurator product={product} size={size} galleryPhotos={galleryPhotos} />;
  if (product.kind === "options") return <OptionsConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "tent_walls") return <TentWallsConfigurator product={product} galleryPhotos={galleryPhotos} />;
  return <SimpleProductDetail product={product} galleryPhotos={galleryPhotos} />;
}

function SimpleProductDetail({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
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
    <div className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}`}>
      <div className="fc-stage">
        {shapeImage ? (
          <Image src={shapeImage} alt={product.name} width={480} height={600} style={{ width: "100%", height: "100%", objectFit: "contain" }} unoptimized />
        ) : (
          <FlagMark className="thumb-empty" />
        )}
      </div>

      <aside className="fc-panel reveal-stagger">
      <div className="fc-panel-scroll">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo/logo-tmave.png" alt="PROVLAJKY.CZ" className="config-hero-logo" style={{ marginBottom: 22 }} />

        <h1 style={{ fontSize: 28 }}>{product.name}</h1>
        {product.subtitle && <p style={{ color: "var(--gray)", marginTop: 8 }}>{product.subtitle}</p>}
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

        <CtaBar
          qty={qty}
          onQtyChange={setQty}
          unitPrice={unitPrice}
          disabled={unitPrice <= 0}
          added={added}
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />
    </div>
  );
}
