"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import type Konva from "konva";
import { Stage, Layer, Rect, Image as KonvaImage, Transformer } from "react-konva";
import { useRouter } from "next/navigation";
import { createBannerArtworkUpload, saveBannerDesigns } from "@/lib/actions/orders";
import type { Design, OrderItem } from "@/lib/types";

const SWATCHES = ["#ffffff", "#000000", "#dc2626", "#2563eb", "#16a34a", "#f59e0b"];
const MAX_SIDE = 520;
// Náhled do vizualizace PDF a do DB — delší strana. Stage editoru je jen 520 px,
// export z něj (i s pixelRatio 2) dává ~1040 px a na A4 vypadá kostrbatě.
const PREVIEW_SIDE = 2400;
const PREVIEW_QUALITY = 0.92;
// Konva na Retině se zasekává na plných megapixelových originálech — do plátna
// jde zmenšený náhled, ostrý export bere sourceImg / File.
const DISPLAY_SIDE = 1400;
const MAX_FILE = 8 * 1024 * 1024;

type NodeAttrs = { x: number; y: number; width: number; height: number; rotation: number };

export type PieceHandle = {
  exportDesign: () => Promise<Design>;
  originalFile: () => File | null;
  clearSelection: () => void;
};

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): string {
  try {
    return canvas.toDataURL("image/jpeg", quality);
  } catch (e) {
    if (e instanceof DOMException && e.name === "SecurityError") {
      throw new Error("Prohlížeč zablokoval export grafiky. Nahraj soubor znovu a ulož.");
    }
    throw e;
  }
}

function compressImage(img: HTMLImageElement, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(img.width, img.height, 1));
  const width = Math.max(1, Math.round(img.width * scale));
  const height = Math.max(1, Math.round(img.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return img.src.startsWith("data:") ? img.src : "";
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(img, 0, 0, width, height);
  return canvasToJpeg(canvas, quality);
}

// Složí banner mimo malé Konva plátno — stejné pozice jako v editoru, ale ve
// vysokém rozlišení pro PDF vizualizaci a ostrý náhled.
function renderHiResPreview(
  bgColor: string,
  img: HTMLImageElement | null,
  attrs: NodeAttrs | null,
  stage: { w: number; h: number }
): string | null {
  const scale = PREVIEW_SIDE / Math.max(stage.w, stage.h);
  const w = Math.max(1, Math.round(stage.w * scale));
  const h = Math.max(1, Math.round(stage.h * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = bgColor || "#ffffff";
  ctx.fillRect(0, 0, w, h);
  if (img && attrs) {
    ctx.save();
    const cx = (attrs.x + attrs.width / 2) * scale;
    const cy = (attrs.y + attrs.height / 2) * scale;
    ctx.translate(cx, cy);
    ctx.rotate((attrs.rotation * Math.PI) / 180);
    ctx.drawImage(
      img,
      (-attrs.width / 2) * scale,
      (-attrs.height / 2) * scale,
      attrs.width * scale,
      attrs.height * scale
    );
    ctx.restore();
  }
  return canvasToJpeg(canvas, PREVIEW_QUALITY);
}

async function uploadOriginal(orderId: string, itemId: string, pieceIndex: number, file: File) {
  const { signedUrl, artworkPath } = await createBannerArtworkUpload(orderId, itemId, pieceIndex, file.name || "grafika");
  const body = new FormData();
  body.append("cacheControl", "3600");
  body.append("", file);
  const res = await fetch(signedUrl, { method: "PUT", body });
  if (!res.ok) throw new Error("Originál grafiky se nepodařilo nahrát. Zkus to znovu.");
  return artworkPath;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    // Bez toho Safari označí canvas jako „tainted“ u https obrázků a toDataURL
    // spadne na „The operation is insecure.“
    if (/^https?:/i.test(src)) img.crossOrigin = "anonymous";
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
  const viewport = page.getViewport({ scale: 3 });
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

function fitBanner(box: { w: number; h: number }): NodeAttrs {
  return { x: 0, y: 0, width: box.w, height: box.h, rotation: 0 };
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
  const [origFile, setOrigFile] = useState<File | null>(null);
  // Data URL držíme zvlášť — export vždy načte čistý obrázek, ať canvas
  // neznečistí cross-origin / Konva cache (Safari: „The operation is insecure.“).
  const sourceDataUrlRef = useRef<string | null>(initial?.fullArtwork?.src || null);
  const artworkPath = initial?.artworkPath || null;
  const [origType, setOrigType] = useState<string | null>(initial?.fullArtwork?.origType || null);
  const [selected, setSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stageRef = useRef<Konva.Stage>(null);
  const transformerRef = useRef<Konva.Transformer>(null);
  const artworkNodeRef = useRef<Konva.Image>(null);
  const [pixelRatio] = useState(() =>
    typeof window !== "undefined" ? Math.min(Math.max(window.devicePixelRatio || 1, 1), 2) : 1
  );

  useEffect(() => {
    const fa = initial?.fullArtwork;
    const src = fa?.src;
    if (!src) return;
    let cancelled = false;
    sourceDataUrlRef.current = src.startsWith("data:") ? src : null;
    loadImage(src)
      .then(async (img) => {
        if (cancelled) return;
        // Remote src přerenderujeme do data URL, ať jde exportovat.
        if (!src.startsWith("data:")) {
          try {
            const safe = compressImage(img, PREVIEW_SIDE, PREVIEW_QUALITY);
            sourceDataUrlRef.current = safe;
            img = await loadImage(safe);
          } catch {
            /* necháme display, export při uložení požádá o znovunahrání */
          }
        }
        if (cancelled) return;
        setArtworkImg(img);
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
    tr.forceUpdate();
    tr.getLayer()?.batchDraw();
  }, [selected, artworkImg, artworkAttrs]);

  useImperativeHandle(ref, () => ({
    async exportDesign() {
      const attrs = artworkAttrs;
      const dataUrl = sourceDataUrlRef.current;
      if (!dataUrl || !attrs) {
        return { bgColor, artworkPath: artworkPath || undefined, fullArtwork: null, thumb: null };
      }
      const exportImg = await loadImage(dataUrl);
      // Mimo Konva stage — bez úchytů Transformeru, které dřív končily v PDF.
      const thumb = renderHiResPreview(bgColor, exportImg, attrs, size);
      return {
        bgColor,
        artworkPath: artworkPath || undefined,
        fullArtwork: {
          src: compressImage(exportImg, PREVIEW_SIDE, PREVIEW_QUALITY),
          origType: origType || undefined,
          x: attrs.x / size.w,
          y: attrs.y / size.h,
          w: attrs.width / size.w,
          h: attrs.height / size.h,
          rotation: attrs.rotation,
        },
        thumb,
        flagBounds: { x: 0, y: 0, w: size.w, h: size.h, pr: PREVIEW_SIDE / Math.max(size.w, size.h) },
      };
    },
    originalFile() {
      return origFile;
    },
    clearSelection() {
      setSelected(false);
    },
  }));

  async function place(img: HTMLImageElement, file: File, sourceDataUrl: string) {
    sourceDataUrlRef.current = sourceDataUrl;
    const display =
      Math.max(img.width, img.height) > DISPLAY_SIDE
        ? await loadImage(compressImage(img, DISPLAY_SIDE, 0.9))
        : img;
    setArtworkImg(display);
    setArtworkAttrs(fitContain(display, size));
    setOrigFile(file);
    setOrigType(file.type || null);
    setSelected(false);
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
      if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
        const url = URL.createObjectURL(file);
        try {
          const png = await renderPdfFirstPage(url);
          await place(await loadImage(png), file, png);
        } finally {
          URL.revokeObjectURL(url);
        }
      } else {
        const dataUrl = await readFile(file);
        await place(await loadImage(dataUrl), file, dataUrl);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setError(/insecure|SecurityError/i.test(msg) ? "Prohlížeč zablokoval grafiku. Zkus jiný soubor (JPG/PNG)." : "Soubor se nepodařilo načíst.");
    }
  }

  function centerToBanner() {
    const node = artworkNodeRef.current;
    if (node) {
      node.scaleX(1);
      node.scaleY(1);
      node.rotation(0);
    }
    setArtworkAttrs(fitBanner(size));
    setSelected(true);
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
        <div style={{ display: "flex", gap: 8 }}>
          {artworkImg && (
            <button type="button" className="btn" onClick={centerToBanner} title="Vycentruje a roztáhne grafiku přesně na rozměr banneru">
              Vycentrovat
            </button>
          )}
          <label className="btn" style={{ cursor: "pointer" }}>
            {artworkImg ? "Nahradit grafiku" : "Nahrát grafiku"}
            <input type="file" accept="image/*,application/pdf" onChange={handleFile} hidden />
          </label>
        </div>
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
          pixelRatio={pixelRatio}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) setSelected(false);
          }}
        >
          <Layer>
            <Rect x={0} y={0} width={size.w} height={size.h} fill={bgColor || "#ffffff"} />
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
            <Rect x={0} y={0} width={size.w} height={size.h} stroke="#111827" strokeWidth={2} listening={false} />
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
      for (const handle of refs.current.slice(0, qty)) handle?.clearSelection();
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

      const pieces: Design[] = [];
      for (let i = 0; i < qty; i++) {
        const handle = refs.current[i];
        const design = (await handle?.exportDesign()) || { thumb: null, fullArtwork: null };
        const file = handle?.originalFile() || null;
        if (file) design.artworkPath = await uploadOriginal(orderId, item.id, i, file);
        pieces.push(design);
      }
      const withArt = pieces.filter((p) => p.fullArtwork || p.thumb);
      if (!withArt.length) {
        setError("Nahraj grafiku aspoň k jednomu kusu.");
        return;
      }
      await saveBannerDesigns(item.id, orderId, pieces);
      setSaved(true);
      setTimeout(() => router.push(`/orders/${orderId}`), 600);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      setError(
        /unexpected response/i.test(msg)
          ? "Server grafiku nepřijal. Soubor je na jedno uložení moc velký."
          : /insecure|SecurityError/i.test(msg)
            ? "Prohlížeč zablokoval export. Nahraj grafiku znovu a ulož."
            : msg || "Uložení selhalo."
      );
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
