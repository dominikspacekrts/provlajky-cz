"use client";

// Editor vlastního návrhu vlajky: nahrání loga, posun tažením, barva pozadí,
// u HS vlajek barva tunelu. Náhled se kreslí přesně podle tvaru vlajky.

import { useCallback, useEffect, useRef, useState } from "react";
import type { FlagShape } from "@/lib/types";
import {
  DEFAULT_DESIGN,
  designPainter,
  drawFlagCanvas,
  type FlagDesign,
} from "@/lib/flagShapes";

const BG_PRESETS = ["#ffe701", "#ffffff", "#111111", "#e02020", "#0a54c2", "#0a8f3c", "#f97316", "#7c3aed"];

type Props = {
  shape: FlagShape;
  hs: boolean;
  sleeveColor: "black" | "white";
  initial?: FlagDesign | null;
  onSleeveColor: (c: "black" | "white") => void;
  onSave: (design: FlagDesign) => void;
  onClose: () => void;
};

export default function FlagEditorModal({ shape, hs, sleeveColor, initial, onSleeveColor, onSave, onClose }: Props) {
  const [design, setDesign] = useState<FlagDesign>(initial ?? DEFAULT_DESIGN);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef(false);

  // načtení loga z dataURL
  useEffect(() => {
    if (!design.logoDataUrl) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset odvozeného stavu při odebrání loga
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design.logoDataUrl]);

  // překreslení náhledu
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFlagCanvas(
      { shape, hs, sleeveColor, color: design.bgColor, drawDesign: designPainter(design, logoImg) },
      canvas
    );
  }, [shape, hs, sleeveColor, design, logoImg]);

  // zavření Escape + zámek scrollu
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const moveLogo = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * canvas.width;
    const y = ((e.clientY - r.top) / r.height) * canvas.height;
    const flagH = canvas.height * (1024 / 1180); // vlajka zabírá horní část plátna, dole je pahýl tyče
    setDesign((d) => ({
      ...d,
      logoX: Math.min(1, Math.max(0, x / canvas.width)),
      logoY: Math.min(1, Math.max(0, y / flagH)),
    }));
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      // SVG necháme beze změny, bitmapy zmenšíme, aby se návrh vešel do objednávky
      if (file.type === "image/svg+xml") {
        setDesign((d) => ({ ...d, logoDataUrl: dataUrl }));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const MAX = 1400;
        const scale = Math.min(1, MAX / Math.max(img.naturalWidth, img.naturalHeight));
        if (scale >= 1) {
          setDesign((d) => ({ ...d, logoDataUrl: dataUrl }));
          return;
        }
        const c = document.createElement("canvas");
        c.width = Math.round(img.naturalWidth * scale);
        c.height = Math.round(img.naturalHeight * scale);
        c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
        const out =
          file.type === "image/jpeg" ? c.toDataURL("image/jpeg", 0.88) : c.toDataURL("image/png");
        setDesign((d) => ({ ...d, logoDataUrl: out }));
      };
      img.onerror = () => setDesign((d) => ({ ...d, logoDataUrl: dataUrl }));
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className="editor-backdrop" onClick={onClose}>
      <div className="editor-panel" role="dialog" aria-modal="true" aria-label="Editor vlastní vlajky" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <h2>Navrhněte si vlastní vlajku</h2>
          <button className="editor-close" onClick={onClose} aria-label="Zavřít">✕</button>
        </div>

        <div className="editor-body">
          <div className="editor-preview">
            <canvas
              ref={canvasRef}
              onPointerDown={(e) => {
                if (!logoImg) return;
                dragRef.current = true;
                e.currentTarget.setPointerCapture(e.pointerId);
                moveLogo(e);
              }}
              onPointerMove={(e) => dragRef.current && moveLogo(e)}
              onPointerUp={() => (dragRef.current = false)}
              style={{ cursor: logoImg ? "grab" : "default", touchAction: "none" }}
            />
            <p className="editor-hint">{logoImg ? "Logem pohybujete tažením myší." : "Nahrajte logo a umístěte ho tažením."}</p>
          </div>

          <div className="editor-controls">
            <div className="option-label" style={{ marginTop: 0 }}>Vaše logo</div>
            <label className="editor-upload">
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={(e) => handleFile(e.target.files?.[0])} hidden />
              {design.logoDataUrl ? "Nahrát jiné logo" : "Nahrát logo (PNG, JPG, SVG)"}
            </label>

            {logoImg && (
              <>
                <div className="option-label">Velikost loga</div>
                <input
                  type="range"
                  min={10}
                  max={95}
                  value={Math.round(design.logoScale * 100)}
                  onChange={(e) => setDesign((d) => ({ ...d, logoScale: Number(e.target.value) / 100 }))}
                  style={{ width: "100%" }}
                />
              </>
            )}

            <div className="option-label">Barva pozadí</div>
            <div className="editor-swatches">
              {BG_PRESETS.map((c) => (
                <button
                  key={c}
                  className={`swatch${design.bgColor === c ? " active" : ""}`}
                  style={{ background: c }}
                  onClick={() => setDesign((d) => ({ ...d, bgColor: c }))}
                  aria-label={`Barva ${c}`}
                />
              ))}
              <label className="swatch custom" title="Vlastní barva">
                <input type="color" value={design.bgColor} onChange={(e) => setDesign((d) => ({ ...d, bgColor: e.target.value }))} />
              </label>
            </div>

            {hs && (
              <>
                <div className="option-label">Barva tunelu (HS)</div>
                <div className="option-row">
                  {(["black", "white"] as const).map((c) => (
                    <button key={c} className={`option-chip${sleeveColor === c ? " active" : ""}`} onClick={() => onSleeveColor(c)}>
                      {c === "black" ? "Černá" : "Bílá"}
                    </button>
                  ))}
                </div>
                <p className="editor-note">U vlajek s vyztuženým tunelem (HS) vyrábíme tunel pouze v černé nebo bílé barvě.</p>
              </>
            )}

            <div className="editor-actions">
              <button className="btn-yellow" onClick={() => onSave(design)}>Uložit návrh</button>
              <button className="btn-outline" onClick={onClose}>Zrušit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
