"use client";

import { useEffect, useRef, useState } from "react";
import type Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva";
import { useRouter } from "next/navigation";
import { saveItemDesign } from "@/lib/actions/orders";
import type { Design, OrderItem } from "@/lib/types";

const SWATCHES = ["#ffffff", "#000000", "#dc2626", "#2563eb", "#16a34a", "#f59e0b", "#7c3aed"];
const MAX_W = 480;

type NodeAttrs = { x: number; y: number; width: number; height: number; rotation: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function renderPdfFirstPage(url: string): Promise<{ dataUrl: string; width: number; height: number }> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjsLib.getDocument({ url }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d")!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return { dataUrl: canvas.toDataURL("image/png"), width: viewport.width, height: viewport.height };
}

function templatePath(size: string, shape: string) {
  return encodeURI(`/templates/HS/${size}/${size}${shape} HS.pdf`);
}

export default function DesignEditorCanvas({ orderId, item }: { orderId: string; item: OrderItem }) {
  const router = useRouter();
  const isFlag = item.type === "flag";

  const [stageSize, setStageSize] = useState({ w: MAX_W, h: MAX_W });
  const [templateImg, setTemplateImg] = useState<HTMLImageElement | null>(null);
  const [loadingTemplate, setLoadingTemplate] = useState(isFlag);
  const [bgColor, setBgColor] = useState<string | null>(item.design?.bgColor || null);
  const [sleeveColor, setSleeveColor] = useState<"white" | "black">(item.design?.sleeveColor || "white");
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [logoAttrs, setLogoAttrs] = useState<NodeAttrs | null>(null);
  const [artworkImg, setArtworkImg] = useState<HTMLImageElement | null>(null);
  const [artworkAttrs, setArtworkAttrs] = useState<NodeAttrs | null>(null);
  const [selected, setSelected] = useState<"logo" | "artwork" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const logoNodeRef = useRef<Konva.Image>(null);
  const artworkNodeRef = useRef<Konva.Image>(null);

  // Load template (flags) or compute a blank canvas sized to the banner's aspect ratio.
  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (isFlag && item.shape && item.size) {
        try {
          const { dataUrl, width, height } = await renderPdfFirstPage(templatePath(item.size, item.shape));
          const img = await loadImage(dataUrl);
          if (cancelled) return;
          const scale = MAX_W / width;
          setStageSize({ w: MAX_W, h: Math.round(height * scale) });
          setTemplateImg(img);
        } catch {
          if (!cancelled) setError("Šablonu se nepodařilo načíst — pokračuj bez podkladu.");
        } finally {
          if (!cancelled) setLoadingTemplate(false);
        }
      } else {
        const ratio = item.width_cm && item.height_cm ? item.height_cm / item.width_cm : 0.6;
        setStageSize({ w: MAX_W, h: Math.round(MAX_W * ratio) });
      }
    }
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Restore an existing saved design once we know the real stage size.
  useEffect(() => {
    if (loadingTemplate) return;
    const design = item.design;
    if (!design) return;
    (async () => {
      if (design.logo?.src) {
        try {
          const img = await loadImage(design.logo.src);
          setLogoImg(img);
          setLogoAttrs({
            x: design.logo.x * stageSize.w,
            y: design.logo.y * stageSize.h,
            width: design.logo.w * stageSize.w,
            height: design.logo.h * stageSize.h,
            rotation: design.logo.rotation || 0,
          });
        } catch {
          /* ignore broken stored image */
        }
      }
      if (design.fullArtwork?.src) {
        try {
          const img = await loadImage(design.fullArtwork.src);
          setArtworkImg(img);
          setArtworkAttrs({
            x: design.fullArtwork.x * stageSize.w,
            y: design.fullArtwork.y * stageSize.h,
            width: design.fullArtwork.w * stageSize.w,
            height: design.fullArtwork.h * stageSize.h,
            rotation: design.fullArtwork.rotation || 0,
          });
        } catch {
          /* ignore broken stored image */
        }
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingTemplate]);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    const node = selected === "logo" ? logoNodeRef.current : selected === "artwork" ? artworkNodeRef.current : null;
    tr.nodes(node ? [node] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, logoImg, artworkImg]);

  function placeImage(kind: "logo" | "artwork", img: HTMLImageElement) {
    const widthFrac = kind === "logo" ? 0.3 : 0.65;
    const width = stageSize.w * widthFrac;
    const height = width * (img.height / img.width);
    const attrs: NodeAttrs = { x: (stageSize.w - width) / 2, y: (stageSize.h - height) / 2, width, height, rotation: 0 };
    if (kind === "logo") {
      setLogoImg(img);
      setLogoAttrs(attrs);
    } else {
      setArtworkImg(img);
      setArtworkAttrs(attrs);
    }
    setSelected(kind);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>, kind: "logo" | "artwork") {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.type === "application/pdf") {
        const url = URL.createObjectURL(file);
        const { dataUrl } = await renderPdfFirstPage(url);
        URL.revokeObjectURL(url);
        placeImage(kind, await loadImage(dataUrl));
      } else {
        const reader = new FileReader();
        reader.onload = async () => placeImage(kind, await loadImage(String(reader.result)));
        reader.readAsDataURL(file);
      }
    } catch {
      setError("Soubor se nepodařilo načíst.");
    }
  }

  function handleTransformEnd(kind: "logo" | "artwork") {
    const node = kind === "logo" ? logoNodeRef.current : artworkNodeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    const attrs: NodeAttrs = {
      x: node.x(),
      y: node.y(),
      width: Math.max(8, node.width() * scaleX),
      height: Math.max(8, node.height() * scaleY),
      rotation: node.rotation(),
    };
    if (kind === "logo") setLogoAttrs(attrs);
    else setArtworkAttrs(attrs);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const thumb = stageRef.current?.toDataURL({ pixelRatio: 2 });
      const design: Design = {
        bgColor: bgColor ?? undefined,
        sleeveColor: isFlag ? sleeveColor : undefined,
        logo:
          logoImg && logoAttrs
            ? {
                src: logoImg.src,
                x: logoAttrs.x / stageSize.w,
                y: logoAttrs.y / stageSize.h,
                w: logoAttrs.width / stageSize.w,
                h: logoAttrs.height / stageSize.h,
                rotation: logoAttrs.rotation,
              }
            : null,
        fullArtwork:
          artworkImg && artworkAttrs
            ? {
                src: artworkImg.src,
                x: artworkAttrs.x / stageSize.w,
                y: artworkAttrs.y / stageSize.h,
                w: artworkAttrs.width / stageSize.w,
                h: artworkAttrs.height / stageSize.h,
                rotation: artworkAttrs.rotation,
              }
            : null,
        thumb: thumb || null,
        flagBounds: { x: 0, y: 0, w: stageSize.w, h: stageSize.h, pr: 2 },
      };
      await saveItemDesign(item.id, orderId, design);
      setSaved(true);
      setTimeout(() => router.push(`/orders/${orderId}`), 600);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Uložení selhalo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <h2>
        Design — {isFlag ? `tvar ${item.shape}, velikost ${item.size}` : `banner ${item.width_cm}×${item.height_cm} cm`}
      </h2>
      <p className="muted" style={{ fontSize: 13 }}>
        Zjednodušená verze editoru: šablona je statický podklad (bez přesného vystřižení do tvaru vlajky), loga a grafiku umísťuješ
        tažením a otáčením podle vytištěných čar.
      </p>

      <div className="toolbar">
        <div className="swatches">
          {SWATCHES.map((c) => (
            <button
              key={c}
              type="button"
              className={`swatch${bgColor === c ? " active" : ""}`}
              style={{ background: c, borderColor: c === "#ffffff" ? "#d1d5db" : c }}
              onClick={() => setBgColor(c)}
              title={c}
            />
          ))}
          <input type="color" value={bgColor || "#ffffff"} onChange={(e) => setBgColor(e.target.value)} title="Vlastní barva" />
          {bgColor && (
            <button type="button" className="btn mini" onClick={() => setBgColor(null)}>
              Zrušit barvu
            </button>
          )}
        </div>

        {isFlag && (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <span className="muted" style={{ fontSize: 13 }}>
              Rukáv:
            </span>
            <button
              type="button"
              className={`btn mini${sleeveColor === "white" ? " active" : ""}`}
              onClick={() => setSleeveColor("white")}
            >
              bílá
            </button>
            <button
              type="button"
              className={`btn mini${sleeveColor === "black" ? " active" : ""}`}
              onClick={() => setSleeveColor("black")}
            >
              černá
            </button>
          </div>
        )}

        <div className="spacer" />

        <label className="btn" style={{ cursor: "pointer" }}>
          Nahrát logo
          <input type="file" accept="image/*" onChange={(e) => handleFile(e, "logo")} hidden />
        </label>
        <label className="btn" style={{ cursor: "pointer" }}>
          Nahrát grafiku
          <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFile(e, "artwork")} hidden />
        </label>
      </div>

      <div className="stage-wrapper">
        {loadingTemplate ? (
          <p className="muted">Načítám šablonu…</p>
        ) : (
          <Stage
            ref={stageRef}
            width={stageSize.w}
            height={stageSize.h}
            onMouseDown={(e) => {
              if (e.target === e.target.getStage()) setSelected(null);
            }}
          >
            <Layer>
              {bgColor ? (
                <Rect x={0} y={0} width={stageSize.w} height={stageSize.h} fill={bgColor} />
              ) : (
                <>
                  <Rect x={0} y={0} width={stageSize.w} height={stageSize.h} fill="#ffffff" />
                  {templateImg && <KonvaImage image={templateImg} x={0} y={0} width={stageSize.w} height={stageSize.h} listening={false} />}
                </>
              )}
              {artworkImg && artworkAttrs && (
                <KonvaImage
                  ref={artworkNodeRef}
                  image={artworkImg}
                  x={artworkAttrs.x}
                  y={artworkAttrs.y}
                  width={artworkAttrs.width}
                  height={artworkAttrs.height}
                  rotation={artworkAttrs.rotation}
                  draggable
                  onClick={() => setSelected("artwork")}
                  onTap={() => setSelected("artwork")}
                  onDragEnd={(e) => setArtworkAttrs((a) => (a ? { ...a, x: e.target.x(), y: e.target.y() } : a))}
                  onTransformEnd={() => handleTransformEnd("artwork")}
                />
              )}
              {logoImg && logoAttrs && (
                <KonvaImage
                  ref={logoNodeRef}
                  image={logoImg}
                  x={logoAttrs.x}
                  y={logoAttrs.y}
                  width={logoAttrs.width}
                  height={logoAttrs.height}
                  rotation={logoAttrs.rotation}
                  draggable
                  onClick={() => setSelected("logo")}
                  onTap={() => setSelected("logo")}
                  onDragEnd={(e) => setLogoAttrs((a) => (a ? { ...a, x: e.target.x(), y: e.target.y() } : a))}
                  onTransformEnd={() => handleTransformEnd("logo")}
                />
              )}
              <Transformer ref={transformerRef} rotateEnabled resizeEnabled anchorSize={12} />
            </Layer>
          </Stage>
        )}
      </div>

      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}

      <div className="header-actions" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit design"}
        </button>
      </div>
    </div>
  );
}
