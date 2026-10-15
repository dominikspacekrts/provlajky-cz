"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import { type Product } from "@/lib/types";
import { itemFromProduct, trackViewItem } from "@/lib/analytics";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";
import { FlagMark } from "@/components/Icons";
import { useConfiguratorLayout } from "@/lib/useConfiguratorLayout";
import { AddedToCartDialog, FcContactLink, FcDesktopHeader } from "@/components/ConfiguratorChrome";
import MdText from "@/components/MdText";

// Každý konfigurátor je vlastní chunk — produktová stránka nenačte three.js /
// editory, které pro daný kind vůbec nepotřebuje.
const FlagConfigurator = dynamic(() => import("./FlagConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});
const BannerConfigurator = dynamic(() => import("./BannerConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});
const VariantConfigurator = dynamic(() => import("./VariantConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});
const OptionsConfigurator = dynamic(() => import("./OptionsConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});
const CustomFlagConfigurator = dynamic(() => import("./CustomFlagConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});
const TentWallsConfigurator = dynamic(() => import("./TentWallsConfigurator"), {
  loading: () => <p className="muted">Načítám konfigurátor…</p>,
});

export default function ProductDetail({
  product,
  size,
  galleryPhotos,
}: {
  product: Product;
  size?: string;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const trackedSlug = useRef<string | null>(null);
  useEffect(() => {
    if (trackedSlug.current === product.slug) return;
    trackedSlug.current = product.slug;
    trackViewItem(itemFromProduct(product));
  }, [product]);

  if (product.kind === "configurable") return <FlagConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "custom_flag") return <CustomFlagConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "banner_m2") return <BannerConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "variant") return <VariantConfigurator product={product} size={size} galleryPhotos={galleryPhotos} />;
  if (product.kind === "options") return <OptionsConfigurator product={product} galleryPhotos={galleryPhotos} />;
  if (product.kind === "tent_walls") return <TentWallsConfigurator product={product} galleryPhotos={galleryPhotos} />;
  return <SimpleProductDetail product={product} galleryPhotos={galleryPhotos} />;
}

function needsUnoptimized(src: string) {
  return src.startsWith("data:") || src.startsWith("blob:");
}

function SimpleProductDetail({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();
  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);

  const unitPrice = useMemo(() => product.price, [product]);
  const shapeImage = product.images?.[0];

  function handleAdd() {
    addLine({
      productId: product.id,
      productSlug: product.slug,
      productCategory: product.category,
      name: product.name,
      type: "product",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: shapeImage || null,
    });
    setAskNext(true);
  }

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        {shapeImage ? (
          <Image
            src={shapeImage}
            alt={product.name}
            width={480}
            height={600}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized={needsUnoptimized(shapeImage)}
            priority
          />
        ) : (
          <FlagMark className="thumb-empty" />
        )}
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
          {unitPrice <= 0 && (
            <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
              Pro tuto variantu zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
            </p>
          )}
          {product.description && (
            <MdText
              style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}
            >
              {product.description}
            </MdText>
          )}
        </div>

        <CtaBar
          qty={qty}
          onQtyChange={setQty}
          unitPrice={unitPrice}
          vatRate={product.vat_rate}
          disabled={unitPrice <= 0}
          addLabel="Do košíku"
          onAdd={handleAdd}
        />
      </aside>

      <ConfiguratorGallery photos={galleryPhotos ?? []} />

      <AddedToCartDialog open={askNext} onClose={() => setAskNext(false)} summary={product.name} />
    </div>
  );
}
