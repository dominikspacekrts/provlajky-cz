"use client";

// Konfigurátor variant (nůžkové/nafukovací stany, totemy, brány, díly).
// Uživatel vybere variantu a rychlost dodání (do 14 dní / do 2 měsíců).

import { useMemo, useState } from "react";
import Image from "next/image";
import { useCart } from "@/lib/cart";
import {
  DELIVERY_HINT,
  DELIVERY_LABEL,
  fmtMoney,
  availableSpeeds,
  variantSellPrice,
  type DeliverySpeed,
} from "@/lib/money";
import { TENT_PRODUCT_BLURB } from "@/lib/productCopy";
import {
  wallsFromVariant,
  tentRealImage,
  INFLATABLE_TENT_IMAGE,
  type Product,
  type ProductVariant,
} from "@/lib/types";
import { FlagMark } from "@/components/Icons";
import { useConfiguratorLayout } from "@/lib/useConfiguratorLayout";
import {
  AddedToCartDialog,
  FcContactLink,
  FcDesktopHeader,
  FcStepBody,
  FcStepHeader,
  FcStepNav,
} from "@/components/ConfiguratorChrome";
import ConfiguratorGallery from "@/components/ConfiguratorGallery";
import CtaBar from "@/components/CtaBar";

export default function VariantConfigurator({
  product,
  size,
  galleryPhotos,
}: {
  product: Product;
  size?: string;
  galleryPhotos?: { id: string; image: string }[];
}) {
  const { addLine } = useCart();
  const { isMobile, pageRef } = useConfiguratorLayout();

  const variants = useMemo<ProductVariant[]>(() => {
    const all = product.config?.variants ?? [];
    if (!size) return all;
    const filtered = all.filter((v) => (v.size ?? "").trim() === size.trim());
    return filtered.length > 0 ? filtered : all;
  }, [product, size]);

  const isNuzkovy = product.category === "nuzkove-stany";
  const isNafukovaci = product.category === "nafukovaci-stany";
  const title = size ? `${product.name} ${size}` : product.name;

  const stripSizePrefix = (label: string) =>
    size ? label.replace(new RegExp(`^\\s*${size.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*·\\s*`), "") : label;

  const [variantId, setVariantId] = useState<string>(variants[0]?.id ?? "");
  const selected = variants.find((v) => v.id === variantId) ?? variants[0];

  const speeds = selected ? availableSpeeds(selected) : [];
  const [speed, setSpeed] = useState<DeliverySpeed>("fast");
  const activeSpeed: DeliverySpeed = speeds.includes(speed) ? speed : speeds[0] ?? "fast";

  const [qty, setQty] = useState(1);
  const [askNext, setAskNext] = useState(false);
  const [step, setStep] = useState(0);

  const unitPrice = selected ? variantSellPrice(selected, activeSpeed) : 0;
  const image = product.images?.[0];

  const mobileSteps = useMemo(() => {
    if (speeds.length > 0) return ["Varianta", "Dodání"] as const;
    return ["Varianta"] as const;
  }, [speeds.length]);

  function handleAdd() {
    if (!selected || unitPrice <= 0) return;
    addLine({
      productId: product.id,
      productSlug: product.slug,
      productCategory: product.category,
      name: title,
      type: "product",
      shape: null,
      size: null,
      qty,
      unitPrice,
      vatRate: product.vat_rate,
      thumb: image || null,
      note: `${selected.label} · ${DELIVERY_LABEL[activeSpeed]}`,
      variantId: selected.id,
    });
    setAskNext(true);
  }

  if (variants.length === 0) {
    return (
      <div className="container">
        <div className="page-panel">
          <h1 style={{ fontSize: 30 }}>{title}</h1>
          <p style={{ color: "var(--gray)", marginTop: 12 }}>
            Varianty připravujeme. Napište nám na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> a
            připravíme nabídku na míru.
          </p>
        </div>
      </div>
    );
  }

  const variantBlock = (
    <>
      <div className="option-label">{isNuzkovy ? "Konfigurace stěn" : "Varianta"}</div>
      <div className="option-row">
        {variants.map((v) => (
          <button
            key={v.id}
            className={`option-chip${selected?.id === v.id ? " active" : ""}`}
            onClick={() => setVariantId(v.id)}
          >
            {stripSizePrefix(v.label)}
          </button>
        ))}
      </div>
      {unitPrice <= 0 && speeds.length === 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Pro tuto variantu zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const deliveryBlock = (
    <>
      <div className="option-label">Rychlost dodání</div>
      <div className="option-row fc-delivery-row">
        {speeds.map((s) => (
          <button
            key={s}
            className={`option-chip fc-delivery-chip${activeSpeed === s ? " active" : ""}`}
            onClick={() => setSpeed(s)}
          >
            <span className="fc-delivery-main">
              {DELIVERY_LABEL[s]} · {fmtMoney(variantSellPrice(selected, s))}
            </span>
            <span className="fc-delivery-hint">{DELIVERY_HINT[s]}</span>
          </button>
        ))}
      </div>
      <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 4, lineHeight: 1.45 }}>
        Lhůta dodání běží od přijetí platby na náš účet.
      </p>
      {unitPrice <= 0 && (
        <p style={{ color: "var(--gray)", fontSize: 12.5, marginTop: 6 }}>
          Pro tuto variantu zatím nemáme nastavenou cenu — napište nám na info@provlajky.cz.
        </p>
      )}
    </>
  );

  const productBlurb = TENT_PRODUCT_BLURB[product.category];

  return (
    <div
      ref={pageRef}
      className={`fc-page${galleryPhotos?.length ? " fc-page-3col" : ""}${isMobile ? " fc-page-steps" : ""}`}
    >
      <div className="fc-stage">
        {(isNuzkovy || isNafukovaci) && selected ? (
          <Image
            src={isNuzkovy ? tentRealImage(wallsFromVariant(selected)) : INFLATABLE_TENT_IMAGE}
            alt={`${product.name} ${selected.label}`}
            width={640}
            height={480}
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
            unoptimized
          />
        ) : image ? (
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
              <FcStepHeader steps={mobileSteps} step={step} />
              <FcStepBody step={step}>
                {step === 0 && (
                  <>
                    {productBlurb && <p className="fc-product-blurb">{productBlurb}</p>}
                    {variantBlock}
                  </>
                )}
                {step === 1 && speeds.length > 0 && deliveryBlock}
              </FcStepBody>
            </>
          ) : (
            <>
              <FcDesktopHeader name={title} subtitle={product.subtitle} />
              {productBlurb && <p className="fc-product-blurb">{productBlurb}</p>}
              {variantBlock}
              {speeds.length > 0 && deliveryBlock}
              {product.description && (
                <p style={{ color: "var(--gray)", fontSize: 13, marginTop: 14, lineHeight: 1.5, whiteSpace: "pre-line" }}>
                  {product.description}
                </p>
              )}
            </>
          )}
        </div>

        {isMobile && (
          <FcStepNav
            step={step}
            stepsCount={mobileSteps.length}
            onBack={() => setStep(step - 1)}
            onNext={() => setStep(step + 1)}
          />
        )}

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
        summary={`${title} · ${selected?.label ?? ""} · ${DELIVERY_LABEL[activeSpeed]}`}
      />
    </div>
  );
}
