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

// Doba zavírací animace (viz .editor-backdrop.closing / .editor-panel.closing v CSS) —
// onClose reálně odpojí modal až po jejím doběhnutí, jinak by se řezalo.
const CLOSE_MS = 220;

// Poměr výšky vlajky k celému plátnu (zbytek dole je pahýl tyče) — viz TEXTURE_H/FLAG_H.
const FLAG_H_FRAC = 1024 / 1180;

type DragMode = "move" | "resize" | "rotate" | null;

function logoGeometry(design: FlagDesign, logoImg: HTMLImageElement, canvas: HTMLCanvasElement) {
  const flagH = canvas.height * FLAG_H_FRAC;
  const lw = canvas.width * design.logoScale;
  const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
  return {
    cx: design.logoX * canvas.width,
    cy: design.logoY * flagH,
    hw: lw / 2,
    hh: lh / 2,
    rot: ((design.logoRotation || 0) * Math.PI) / 180,
    flagH,
  };
}

function toCanvasPoint(e: { clientX: number; clientY: number }, canvas: HTMLCanvasElement) {
  const r = canvas.getBoundingClientRect();
  return {
    x: ((e.clientX - r.left) / r.width) * canvas.width,
    y: ((e.clientY - r.top) / r.height) * canvas.height,
  };
}

export default function FlagEditorModal({ shape, hs, sleeveColor, initial, onSleeveColor, onSave, onClose }: Props) {
  const [design, setDesign] = useState<FlagDesign>(initial ?? DEFAULT_DESIGN);
  const [logoImg, setLogoImg] = useState<HTMLImageElement | null>(null);
  const [closing, setClosing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Aktivní gesto (tažení loga / rohový bod na zvětšení / žlutý bod na
  // otočení) + snímek stavu z okamžiku pointerdown, ze kterého se počítá
  // poměr zvětšení a úhel otočení během tažení.
  const dragModeRef = useRef<DragMode>(null);
  const dragStartRef = useRef({ scale: 0, dist: 0 });

  const requestClose = useCallback(() => {
    setClosing(true);
    setTimeout(onClose, CLOSE_MS);
  }, [onClose]);

  // načtení loga z dataURL — PDF nejde vykreslit na canvas, logoImg zůstává null.
  useEffect(() => {
    if (!design.logoDataUrl || design.logoIsPdf) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset odvozeného stavu při odebrání loga / PDF bez náhledu
      setLogoImg(null);
      return;
    }
    const img = new Image();
    img.onload = () => setLogoImg(img);
    img.src = design.logoDataUrl;
  }, [design.logoDataUrl, design.logoIsPdf]);

  // překreslení náhledu + úchyty pro tažení/zvětšení/otočení loga (jen v editoru,
  // do sdíleného designPainter nejdou — ten kreslí i finální texturu/náhled).
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    drawFlagCanvas(
      { shape, hs, sleeveColor, color: design.bgColor, drawDesign: designPainter(design, logoImg) },
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

    // "Mravenčí pochod" (černá + bílá čerchovaná čára přes sebe) místo jedné
    // barvy — obrys musí zůstat vidět i když se barva podkladu shoduje s
    // barvou úchytu (např. žlutá na žluté).
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
    // roh = zvětšení (bez ikony, poloha stačí), bod nad logem = otočení
    // (kroužek se šipkou, aby šlo od rohu rozeznat i na stejně barevném pozadí)
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
  }, [shape, hs, sleeveColor, design, logoImg]);

  // zavření Escape + zámek scrollu
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

  // Zjistí, jestli pointerdown padl na roh (zvětšení) nebo žlutý bod nad
  // logem (otočení) — jinak se logo prostě posune na místo doteku (chování
  // zachované z předchozí verze).
  const pickDragMode = useCallback(
    (px: number, py: number, canvas: HTMLCanvasElement): DragMode => {
      if (!logoImg) return null;
      const { cx, cy, hw, hh, rot } = logoGeometry(design, logoImg, canvas);
      const dx = px - cx,
        dy = py - cy;
      const cos = Math.cos(rot),
        sin = Math.sin(rot);
      // inverzní rotace — souřadnice ukazatele v lokálním prostoru loga
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
    const flagH = canvas.height * FLAG_H_FRAC;
    setDesign((d) => ({
      ...d,
      logoX: Math.min(1, Math.max(0, px / canvas.width)),
      logoY: Math.min(1, Math.max(0, py / flagH)),
    }));
  }, []);

  const resizeLogo = useCallback((px: number, py: number, canvas: HTMLCanvasElement) => {
    if (!logoImg) return;
    const { cx, cy } = logoGeometry(design, logoImg, canvas);
    const dist = Math.hypot(px - cx, py - cy) || 1;
    const { scale, dist: startDist } = dragStartRef.current;
    const next = Math.min(1.3, Math.max(0.05, scale * (dist / startDist)));
    setDesign((d) => ({ ...d, logoScale: next }));
  }, [design, logoImg]);

  const rotateLogo = useCallback((px: number, py: number, canvas: HTMLCanvasElement) => {
    if (!logoImg) return;
    const { cx, cy } = logoGeometry(design, logoImg, canvas);
    const angleDeg = (Math.atan2(py - cy, px - cx) * 180) / Math.PI;
    setDesign((d) => ({ ...d, logoRotation: Math.round(angleDeg + 90) }));
  }, [design, logoImg]);

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
      // PDF nejde vykreslit na canvas — přiložíme ho bez živého náhledu/pozicování.
      setDesign((d) => ({ ...d, logoDataUrl: dataUrl, logoIsPdf: isPdf }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <div className={`editor-backdrop${closing ? " closing" : ""}`} onClick={requestClose}>
      <div className={`editor-panel${closing ? " closing" : ""}`} role="dialog" aria-modal="true" aria-label="Editor vlastní vlajky" onClick={(e) => e.stopPropagation()}>
        <div className="editor-head">
          <h2>Navrhněte si vlastní vlajku</h2>
          <button className="editor-close" onClick={requestClose} aria-label="Zavřít">✕</button>
        </div>

        <div className="editor-body">
          <div className="editor-preview">
            <canvas
              ref={canvasRef}
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              style={{ cursor: logoImg ? "grab" : "default", touchAction: "none" }}
            />
            <p className="editor-hint">
              {logoImg
                ? "Logo přetáhněte na místo, bílým rohem zvětšíte, žlutým bodem otočíte."
                : design.logoIsPdf
                ? "PDF logo nahráno — umístění na vlajce doladíme ručně, v editoru se nedá živě posouvat."
                : "Nahrajte logo a umístěte ho tažením."}
            </p>
          </div>

          <div className="editor-controls">
            <div className="option-label" style={{ marginTop: 0 }}>Vaše logo</div>
            <label className="editor-upload">
              <input type="file" accept="image/svg+xml,.svg,application/pdf,.pdf" onChange={(e) => handleFile(e.target.files?.[0])} hidden />
              {design.logoDataUrl ? "Nahrát jiné logo" : "Nahrát logo (SVG nebo PDF)"}
            </label>

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

            {!design.logoDataUrl && (
              <p className="editor-note editor-note-warn">Nahrajte prosím logo — bez něj návrh nejde uložit.</p>
            )}
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
              <button className="btn-outline" onClick={requestClose}>Zrušit</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
