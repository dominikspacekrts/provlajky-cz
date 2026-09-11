"use client";

// Produkt s volbami (např. těžká základna dle hmotnosti). Uživatel vybere volbu,
// cena se řídí prodejní cenou volby.

import { useMemo, useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import type { Product, ProductOption } from "@/lib/types";
import { FlagMark } from "@/components/Icons";
import { useConfiguratorLayout } from "@/lib/useConfiguratorLayout";
import {
  AddedToCartDialog,
  FcContactLink,
  FcDesktopHeader,
  FcStepBody,
  FcStepHeader,
} from "@/components/ConfiguratorChrome";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";

const MOBILE_STEPS = ["Varianta"] as const;

export default function OptionsConfigurator({
  product,
  galleryPhotos,
}: {
  product: Product;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const options = useMemo<ProductOption[]>(() => product.config?.options ?? [], [product]);
  const [optionId, setOptionId] = useState<string>(options[0]?.id ?? "");
  const selected = options.find((o) => o.id === optionId) ?? options[0];
  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);

  const unitPrice = selected?.sellPrice ?? 0;
  const image = product.images?.[0];

  function handleAdd() {
    if (!selected || unitPrice <= 0) return;
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
      thumb: image || null,
      note: selected.label,
      optionId: selected.id,
    });
    setAskNext(true);
  }

  const optionsBlock = (
    <>
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
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Cena zatím není nastavená — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
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
          <FlagMark className="thumb-empty" />
        )}
        <FcContactLink />
      </div>

      <aside className={`fc-panel reveal-stagger${isMobile ? " fc-panel-steps" : ""}`}>
        <div className="fc-panel-scroll">
          {isMobile ? (
            <>
              {options.length > 1 ? (
                <FcStepHeader steps={MOBILE_STEPS} step={0} />
              ) : (
                <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              )}
              <FcStepBody step={0}>{optionsBlock}</FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={product.name} subtitle={product.subtitle} />
              {optionsBlock}
              {product.description && (
                <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {product.description}
                </p>
              )}
            </>
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

      <AddedToCartDialog
        open={askNext}
        onClose={() => setAskNext(false)}
        summary={`${product.name}${selected ? ` · ${selected.label}` : ""}`}
      />
    </div>
  );
}
