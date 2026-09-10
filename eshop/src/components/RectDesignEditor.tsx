"use client";

// Editor obdélníkového návrhu (vlajky na zakázku, bannery): nahrání loga,
// posun / zvětšení / otočení, volitelná barva pozadí (u celoplošné grafiky
// ji zákazník nemusí řešit). UX zrcadlí FlagEditorModal.

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  DEFAULT_RECT_DESIGN,
  drawRectCanvas,
  rectCanvasSize,
  rectDesignPainter,
  type RectDesign,
} from "@/lib/rectDesign";
import { CloseMark, MailMark, PaletteMark, UploadMark } from "@/components/Icons";

const BG_PRESETS = ["#ffffff", "#ffe701", "#111111", "#e02020", "#0a54c2", "#0a8f3c", "#f97316", "#7c3aed"];
const CLOSE_MS = 220;

type Props = {
  title?: string;
  widthCm: number;
  heightCm: number;
  initial?: RectDesign | null;
  onSave: (design: RectDesign) => void;
  onClose: () => void;
};

type DragMode = "move" | "resize" | "rotate" | null;

function logoGeometry(design: RectDesign, logoImg: HTMLImageElement, canvas: HTMLCanvasElement) {
  const lw = canvas.width * design.logoScale;
  const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
  return {
    cx: design.logoX * canvas.width,
    cy: design.logoY * canvas.height,
    hw: lw / 2,
    hh: lh / 2,
    rot: ((design.logoRotation || 0) * Math.PI) / 180,
  };
}

function toCanvasPoint(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

export default function RectDesignEditor({
  title = "Navrhněte si vlastní grafiku",
  widthCm,
  heightCm,
  initial,
  onSave,
  onClose,
}: Props) {
  const [design, setDesign] = useState<RectDesign>(initial ?? DEFAULT_RECT_DESIGN);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [closing, setClosing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragModeRef = useRef<DragMode>(null);
  const dragStartRef = useRef({ scale: 0, dist: 0 });

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  useEffect(() => {
    if (!design.logoDataUrl || design.logoIsPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset odvozeného stavu při odebrání loga / PDF
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design.logoDataUrl, design.logoIsPdf]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawRectCanvas(
      {
        widthCm,
        heightCm,
        color: design.bgColor || "#ffffff",
        drawDesign: rectDesignPainter(design, logoImg),
      },
      canvas
    );
    if (!logoImg || !logoImg.complete || logoImg.naturalWidth <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { cx, cy, hw, hh, rot } = logoGeometry(design, logoImg, canvas);
    const cos = Math.cos(rot),
      sin = Math.sin(rot);
    const toWorld = (lx: number, ly: number) => ({ x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos });
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([x, y]) => toWorld(x, y));
    const rotateOffset = canvas.width * 0.09;
    const rotatePt = toWorld(0, -hh - rotateOffset);
    const topCenter = toWorld(0, -hh);

    const path = () => {
      ctx.beginPath();
      corners.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.moveTo(topCenter.x, topCenter.y);
      ctx.lineTo(rotatePt.x, rotatePt.y);
    };
    ctx.save();
    ctx.lineWidth = Math.max(2, canvas.width * 0.0035);
    ctx.strokeStyle = "#111111";
    path();
    ctx.stroke();
    ctx.lineWidth = Math.max(1.2, canvas.width * 0.002);
    ctx.strokeStyle = "#ffffff";
    ctx.setLineDash([canvas.width * 0.012, canvas.width * 0.008]);
    path();
    ctx.stroke();
    ctx.setLineDash([]);

    const handleR = canvas.width * 0.026;
    const drawHandleBase = (p: { x: number; y: number }) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, handleR, 0, Math.PI * 2);
      ctx.fillStyle = "#ffffff";
      ctx.fill();
      ctx.lineWidth = Math.max(2, canvas.width * 0.004);
      ctx.strokeStyle = "#111111";
      ctx.stroke();
    };
    drawHandleBase(corners[2]);
    drawHandleBase(rotatePt);
    ctx.beginPath();
    ctx.arc(rotatePt.x, rotatePt.y, handleR * 0.55, -Math.PI * 0.15, Math.PI * 1.3);
    ctx.strokeStyle = "#111111";
    ctx.lineWidth = Math.max(1.5, canvas.width * 0.0025);
    ctx.stroke();
    const ah = handleR * 0.32;
    const aAngle = Math.PI * 1.3;
    const ax = rotatePt.x + Math.cos(aAngle) * handleR * 0.55;
    const ay = rotatePt.y + Math.sin(aAngle) * handleR * 0.55;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - ah * Math.cos(aAngle - Math.PI / 2.4), ay - ah * Math.sin(aAngle - Math.PI / 2.4));
    ctx.lineTo(ax - ah * Math.cos(aAngle + Math.PI / 4), ay - ah * Math.sin(aAngle + Math.PI / 4));
    ctx.closePath();
    ctx.fillStyle = "#111111";
    ctx.fill();
    ctx.restore();
  }, [widthCm, heightCm, design, logoImg]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && requestClose();
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [requestClose]);

  const pickDragMode = useCallback(
    (px: number, py: number, canvas: HTMLCanvasElement): DragMode => {
      if (!logoImg) return null;
      const { cx, cy, hw, hh, rot } = logoGeometry(design, logoImg, canvas);
      const dx = px - cx,
        dy = py - cy;
      const cos = Math.cos(rot),
        sin = Math.sin(rot);
      const lx = dx * cos + dy * sin;
      const ly = -dx * sin + dy * cos;
      const hitR = canvas.width * 0.045;
      const rotateOffset = canvas.width * 0.09;
      if (Math.hypot(lx - 0, ly - (-hh - rotateOffset)) < hitR) return "rotate";
      if (Math.hypot(lx - hw, ly - hh) < hitR) return "resize";
      return "move";
    },
    [design, logoImg]
  );

  const moveLogo = useCallback((px: number, py: number, canvas: HTMLCanvasElement) => {
    setDesign((d) => ({
      ...d,
      logoX: Math.min(1, Math.max(0, px / canvas.width)),
      logoY: Math.min(1, Math.max(0, py / canvas.height)),
    }));
  }, []);

  const resizeLogo = useCallback(
    (px: number, py: number, canvas: HTMLCanvasElement) => {
      if (!logoImg) return;
      const { cx, cy } = logoGeometry(design, logoImg, canvas);
      const dist = Math.hypot(px - cx, py - cy) || 1;
      const { scale, dist: startDist } = dragStartRef.current;
      const next = Math.min(1.6, Math.max(0.05, scale * (dist / startDist)));
      setDesign((d) => ({ ...d, logoScale: next }));
    },
    [design, logoImg]
  );

  const rotateLogo = useCallback(
    (px: number, py: number, canvas: HTMLCanvasElement) => {
      if (!logoImg) return;
      const { cx, cy } = logoGeometry(design, logoImg, canvas);
      const angleDeg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
      setDesign((d) => ({ ...d, logoRotation: Math.round(angleDeg + 90) }));
    },
    [design, logoImg]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas || !logoImg) return;
      const { x, y } = toCanvasPoint(e, canvas);
      const mode = pickDragMode(x, y, canvas);
      dragModeRef.current = mode;
      if (mode === "resize") {
        const { cx, cy } = logoGeometry(design, logoImg, canvas);
        dragStartRef.current = { scale: design.logoScale, dist: Math.hypot(x - cx, y - cy) || 1 };
      }
      e.currentTarget.setPointerCapture(e.pointerId);
      if (mode === "move") moveLogo(x, y, canvas);
    },
    [design, logoImg, pickDragMode, moveLogo]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const mode = dragModeRef.current;
      if (!canvas || !mode) return;
      const { x, y } = toCanvasPoint(e, canvas);
      if (mode === "move") moveLogo(x, y, canvas);
      else if (mode === "resize") resizeLogo(x, y, canvas);
      else if (mode === "rotate") rotateLogo(x, y, canvas);
    },
    [moveLogo, resizeLogo, rotateLogo]
  );

  const handlePointerUp = useCallback(() => {
    dragModeRef.current = null;
  }, []);

  function handleFile(file: File | undefined) {
    if (!file) return;
    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    const isPdf = file.type === "application/pdf" || /\.pdf$/i.test(file.name);
    if (!isSvg && !isPdf) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      setDesign((d) => ({ ...d, logoDataUrl: dataUrl, logoIsPdf: isPdf }));
    };
    reader.readAsDataURL(file);
  }

  function fillBleed() {
    if (!logoImg) return;
    const { width, height } = rectCanvasSize(widthCm, heightCm);
    const imgRatio = logoImg.naturalWidth / logoImg.naturalHeight;
    const canvasRatio = width / height;
    // pokrytí celého plátna (cover) — větší z potřebných škál
    const scale = imgRatio > canvasRatio ? (height * imgRatio) / width : 1;
    setDesign((d) => ({
      ...d,
      logoX: 0.5,
      logoY: 0.5,
      logoScale: Math.min(1.6, Math.max(1, scale)),
      logoRotation: 0,
    }));
  }

  return (
    <div className={`editor-backdrop${closing ? " closing" : ""}`} onClick={requestClose}>
      <div
        className={`editor-panel${closing ? " closing" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="editor-head">
          <h2>{title}</h2>
          <div className="editor-head-actions">
            <Link href="/kontakt" target="_blank" className="editor-contact-link">
              <MailMark className="editor-contact-link-icon" />
              <span>Kontakt</span>
            </Link>
            <button className="editor-close" onClick={requestClose} aria-label="Zavřít">
              <CloseMark />
            </button>
          </div>
        </div>

        <div className="editor-body">
          <div className="editor-preview">
            <div className="editor-preview-stage">
              <canvas
                ref={canvasRef}
                onPointerDown={handlePointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                style={{
                  cursor: logoImg ? "grab" : "default",
                  touchAction: "none",
                  aspectRatio: `${Math.max(widthCm, 1)} / ${Math.max(heightCm, 1)}`,
                }}
              />
            </div>
            <p className="editor-hint">
              {logoImg
                ? "Logo přetáhněte, rohem zvětšíte, bodem nahoře otočíte."
                : design.logoIsPdf
                ? "PDF nahráno — umístění doladíme ručně, v editoru se nedá živě posouvat."
                : "Nahrajte logo nebo celoplošnou grafiku (SVG / PDF)."}
            </p>
          </div>

          <div className="editor-controls">
            <div className="option-label" style={{ marginTop: 0 }}>
              Grafika / logo
            </div>
            <label className="editor-upload">
              <input
                type="file"
                accept="image/svg+xml,.svg,application/pdf,.pdf"
                onChange={(e) => handleFile(e.target.files?.[0])}
                hidden
              />
              <UploadMark className="editor-upload-icon" />
              <span>{design.logoDataUrl ? "Nahrát jiný soubor" : "Nahrát SVG nebo PDF"}</span>
            </label>
            {logoImg && (
              <button type="button" className="btn-outline" style={{ marginTop: 8, width: "100%" }} onClick={fillBleed}>
                Roztáhnout na celou plochu
              </button>
            )}

            <div className="option-label">Barva pozadí <span style={{ fontVariationSettings: '"wght" 500', textTransform: "none", letterSpacing: 0 }}>(volitelné)</span></div>
            <p className="editor-note" style={{ marginTop: -4 }}>
              U celoplošné grafiky barvu nechte — podklad pak skoro nevidíte.
            </p>
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
                <PaletteMark />
                <input
                  type="color"
                  value={design.bgColor || "#ffffff"}
                  onChange={(e) => setDesign((d) => ({ ...d, bgColor: e.target.value }))}
                />
              </label>
            </div>

            {!design.logoDataUrl && (
              <p className="editor-note editor-note-warn">Nahrajte prosím grafiku — bez ní návrh nejde uložit.</p>
            )}
          </div>
        </div>

        <div className="editor-actions">
          <button
            className="btn-yellow"
            disabled={!design.logoDataUrl}
            onClick={() => {
              onSave(design);
              requestClose();
            }}
          >
            Uložit návrh
          </button>
          <button className="btn-outline" onClick={requestClose}>
            Zrušit
          </button>
        </div>
      </div>
    </div>
  );
}
