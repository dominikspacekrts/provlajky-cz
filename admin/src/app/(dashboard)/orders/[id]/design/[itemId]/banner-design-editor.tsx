"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva";
import { useRouter } from "next/navigation";
import { saveBannerDesigns } from "@/lib/actions/orders";
import type { Design, OrderItem } from "@/lib/types";

const SWATCHES = ["#ffffff", "#000000", "#dc2626", "#2563eb", "#16a34a", "#f59e0b"];
const MAX_SIDE = 520;
const MAX_FILE = 8 * 1024 * 1024;

type NodeAttrs = { x: number; y: number; width: number; height: number; rotation: number };

export type PieceHandle = {
  exportDesign: () => Design;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function readFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function renderPdfFirstPage(url: string): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const pdf = await pdfjsLib.getDocument({ url }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 2 });
  const canvas = document.createElement("canvas");
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas není dostupný.");
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  return canvas.toDataURL("image/png");
}

function stageSize(widthCm: number | null, heightCm: number | null) {
  const w = widthCm || 1;
  const h = heightCm || 1;
  if (w >= h) return { w: MAX_SIDE, h: Math.max(80, Math.round(MAX_SIDE * (h / w))) };
  return { h: MAX_SIDE, w: Math.max(80, Math.round(MAX_SIDE * (w / h))) };
}

function fitContain(img: HTMLImageElement, box: { w: number; h: number }): NodeAttrs {
  const scale = Math.min((box.w * 0.92) / img.width, (box.h * 0.92) / img.height);
  const width = img.width * scale;
  const height = img.height * scale;
  return {
    x: (box.w - width) / 2,
    y: (box.h - height) / 2,
    width,
    height,
    rotation: 0,
  };
}

const BannerPiece = forwardRef<
  PieceHandle,
  {
    index: number;
    total: number;
    widthCm: number | null;
    heightCm: number | null;
    initial: Design | null;
  }
>(function BannerPiece({ index, total, widthCm, heightCm, initial }, ref) {
  const size = stageSize(widthCm, heightCm);
  const [bgColor, setBgColor] = useState(initial?.bgColor || "#ffffff");
  const [artworkImg, setArtworkImg] = useState<HTMLImageElement | null>(null);
  const [artworkAttrs, setArtworkAttrs] = useState<NodeAttrs | null>(null);
  const [origSrc, setOrigSrc] = useState<string | null>(initial?.fullArtwork?.origSrc || initial?.fullArtwork?.src || null);
  const [origType, setOrigType] = useState<string | null>(initial?.fullArtwork?.origType || null);
  const [selected, setSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const artworkNodeRef = useRef<Konva.Image>(null);

  useEffect(() => {
    const src = initial?.fullArtwork?.src;
    if (!src) return;
    let cancelled = false;
    loadImage(src)
      .then((img) => {
        if (cancelled) return;
        setArtworkImg(img);
        const fa = initial?.fullArtwork;
        if (fa) {
          setArtworkAttrs({
            x: fa.x * size.w,
            y: fa.y * size.h,
            width: fa.w * size.w,
            height: fa.h * size.h,
            rotation: fa.rotation || 0,
          });
        } else {
          setArtworkAttrs(fitContain(img, size));
        }
      })
      .catch(() => {
        if (!cancelled) setError("Uloženou grafiku se nepodařilo načíst.");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const tr = transformerRef.current;
    if (!tr) return;
    tr.nodes(selected && artworkNodeRef.current ? [artworkNodeRef.current] : []);
    tr.getLayer()?.batchDraw();
  }, [selected, artworkImg]);

  useImperativeHandle(ref, () => ({
    exportDesign() {
      const thumb = stageRef.current?.toDataURL({ pixelRatio: 2 }) || null;
      const attrs = artworkAttrs;
      return {
        bgColor,
        fullArtwork:
          artworkImg && attrs
            ? {
                src: artworkImg.src,
                origSrc: origSrc || artworkImg.src,
                origType: origType || undefined,
                x: attrs.x / size.w,
                y: attrs.y / size.h,
                w: attrs.width / size.w,
                h: attrs.height / size.h,
                rotation: attrs.rotation,
              }
            : null,
        thumb,
        flagBounds: { x: 0, y: 0, w: size.w, h: size.h, pr: 2 },
      };
    },
  }));

  function place(img: HTMLImageElement, fileSrc: string, fileType: string) {
    setArtworkImg(img);
    setArtworkAttrs(fitContain(img, size));
    setOrigSrc(fileSrc);
    setOrigType(fileType);
    setSelected(true);
    setError(null);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.size > MAX_FILE) {
      setError("Soubor je větší než 8 MB. Zmenši ho a nahraj znovu.");
      return;
    }
    try {
      const original = await readFile(file);
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const url = URL.createObjectURL(file);
        try {
          const png = await renderPdfFirstPage(url);
          place(await loadImage(png), original, "application/pdf");
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        place(await loadImage(original), original, file.type || "image/png");
      }
    } catch {
      setError("Soubor se nepodařilo načíst.");
    }
  }

  function handleTransformEnd() {
    const node = artworkNodeRef.current;
    if (!node) return;
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    node.scaleX(1);
    node.scaleY(1);
    setArtworkAttrs({
      x: node.x(),
      y: node.y(),
      width: Math.max(8, node.width() * scaleX),
      height: Math.max(8, node.height() * scaleY),
      rotation: node.rotation(),
    });
  }

  return (
    <section className="addr-block" style={{ marginTop: 16 }}>
      <div className="row-between" style={{ marginBottom: 10 }}>
        <h3 style={{ margin: 0, fontSize: 16 }}>
          {total > 1 ? `Kus ${index + 1} z ${total}` : "Grafika"} · {widthCm || 0}×{heightCm || 0} cm
        </h3>
        <label className="btn" style={{ cursor: "pointer" }}>
          {artworkImg ? "Nahradit grafiku" : "Nahrát grafiku"}
          <input type="file" accept="image/*,application/pdf" onChange={handleFile} hidden />
        </label>
      </div>
      <div className="swatches" style={{ marginBottom: 10 }}>
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
      </div>
      <div className="stage-wrapper">
        <Stage
          ref={stageRef}
          width={size.w}
          height={size.h}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelected(false);
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={size.w} height={size.h} fill={bgColor || "#ffffff"} stroke="#111827" strokeWidth={2} />
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
                onClick={() => setSelected(true)}
                onTap={() => setSelected(true)}
                onDragEnd={(e) => setArtworkAttrs((a) => (a ? { ...a, x: e.target.x(), y: e.target.y() } : a))}
                onTransformEnd={handleTransformEnd}
              />
            )}
            <Transformer ref={transformerRef} rotateEnabled resizeEnabled anchorSize={12} />
          </Layer>
        </Stage>
      </div>
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
      {!artworkImg && <p className="muted" style={{ fontSize: 13 }}>Nahraj obrázek nebo PDF. Dá se posouvat, zvětšit a otočit.</p>}
    </section>
  );
});

export default function BannerDesignEditor({ orderId, item }: { orderId: string; item: OrderItem }) {
  const router = useRouter();
  const qty = Math.max(1, item.qty || 1);
  const refs = useRef<(PieceHandle | null)[]>([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const initials: (Design | null)[] = Array.from({ length: qty }, (_, i) => {
    if (item.multi_artwork && item.multi_artwork.length) return item.multi_artwork[i] || null;
    return i === 0 ? item.design : null;
  });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const pieces = refs.current.slice(0, qty).map((handle) => handle?.exportDesign() || { thumb: null, fullArtwork: null });
      const withArt = pieces.filter((p) => p.fullArtwork || p.thumb);
      if (!withArt.length) {
        setError("Nahraj grafiku aspoň k jednomu kusu.");
        return;
      }
      await saveBannerDesigns(item.id, orderId, pieces);
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
        Grafika banneru — {item.width_cm || 0}×{item.height_cm || 0} cm
        {qty > 1 ? ` · ${qty} ks` : ""}
      </h2>
      <p className="muted" style={{ fontSize: 13 }}>
        {qty > 1
          ? "Každý kus má vlastní grafiku. Po uložení se objeví ve vizualizaci pro klienta a dodavateli odejde v příloze."
          : "Po uložení se grafika objeví ve vizualizaci pro klienta a dodavateli odejde v příloze."}
      </p>
      {initials.map((initial, i) => (
        <BannerPiece
          key={i}
          ref={(handle) => {
            refs.current[i] = handle;
          }}
          index={i}
          total={qty}
          widthCm={item.width_cm}
          heightCm={item.height_cm}
          initial={initial}
        />
      ))}
      {error && <p style={{ color: "#dc2626", fontSize: 13 }}>{error}</p>}
      <div className="header-actions" style={{ marginTop: 14 }}>
        <button className="btn primary" onClick={handleSave} disabled={saving}>
          {saving ? "Ukládám…" : saved ? "Uloženo ✓" : "Uložit grafiku"}
        </button>
      </div>
    </div>
  );
}
