// Geometrie plážových vlajek podle výrobních šablon (assets/vlajky_editor).
// Tvary A–E: 81 × 256,5 cm, tvar F (kapka): 81,5 × 185,5 cm.
// Souřadnice jsou normalizované na box vlajky: x 0..1 (šířka), y 0..1 (výška, dolů).
// Tunel (rukáv na tyč) vede po levé hraně a přes oblouk nahoře — tam je látka fixní.

import type { FlagShape } from "./types";

export const SHAPE_ASPECT: Record<FlagShape, number> = {
  A: 81 / 256.5,
  B: 81 / 256.5,
  C: 81 / 256.5,
  D: 81 / 256.5,
  E: 81 / 256.5,
  F: 81.5 / 185.5,
};

export const SHAPE_LABELS: Record<FlagShape, string> = {
  A: "Tvar A — zaoblený roh",
  B: "Tvar B — šikmé dno",
  C: "Tvar C — konkávní dno",
  D: "Tvar D — rovné dno",
  E: "Tvar E — list",
  F: "Tvar F — kapka",
};

const f = (n: number) => Math.round(n * 100) / 100;

// Náběžná (fixní) hrana s tunelem: od bodu na levé hraně přes oblouk k pravému hornímu rohu.
function leadingEdgeD(w: number, h: number, shape: FlagShape): string {
  if (shape === "F") {
    return (
      `L 0 ${f(0.4 * h)} ` +
      `C 0 ${f(0.1 * h)} ${f(0.1 * w)} 0 ${f(0.46 * w)} 0 ` +
      `C ${f(0.83 * w)} 0 ${f(w)} ${f(0.1 * h)} ${f(w)} ${f(0.3 * h)}`
    );
  }
  return `L 0 ${f(0.25 * h)} C ${f(0.005 * w)} ${f(0.1 * h)} ${f(0.24 * w)} ${f(0.018 * h)} ${f(w)} ${f(0.008 * h)}`;
}

// Volná hrana (pravá + spodní): od konce náběžné hrany zpět do (0, h).
function trailingEdgeD(w: number, h: number, shape: FlagShape): string {
  switch (shape) {
    case "A":
      return (
        `L ${f(w)} ${f(0.862 * h)} ` +
        `Q ${f(w)} ${f(0.908 * h)} ${f(0.868 * w)} ${f(0.916 * h)} ` +
        `Q ${f(0.44 * w)} ${f(0.972 * h)} 0 ${f(h)}`
      );
    case "B":
      return `L ${f(w)} ${f(0.885 * h)} L 0 ${f(h)}`;
    case "C":
      return `L ${f(w)} ${f(0.875 * h)} Q ${f(0.4 * w)} ${f(0.878 * h)} 0 ${f(h)}`;
    case "D":
      return `L ${f(w)} ${f(0.995 * h)} L 0 ${f(h)}`;
    case "E":
      return (
        `C ${f(1.012 * w)} ${f(0.32 * h)} ${f(1.002 * w)} ${f(0.55 * h)} ${f(0.93 * w)} ${f(0.72 * h)} ` +
        `C ${f(0.8 * w)} ${f(0.9 * h)} ${f(0.42 * w)} ${f(0.995 * h)} 0 ${f(h)}`
      );
    case "F":
      return `Q ${f(0.3 * w)} ${f(0.7 * h)} 0 ${f(h)}`;
  }
}

/** SVG path obrysu vlajky (použitelný i pro Path2D). */
export function flagPathD(shape: FlagShape, w: number, h: number): string {
  return `M 0 ${f(h)} ${leadingEdgeD(w, h, shape)} ${trailingEdgeD(w, h, shape)} Z`;
}

/** SVG path pouze náběžné hrany (tunelu). */
export function leadingPathD(shape: FlagShape, w: number, h: number): string {
  return `M 0 ${f(h)} ${leadingEdgeD(w, h, shape)}`;
}

function shade(hex: string, f: number): string {
  const m = hex.replace("#", "");
  const n = parseInt(m.length === 3 ? m.split("").map((c) => c + c).join("") : m, 16);
  const r = Math.min(255, Math.max(0, Math.round(((n >> 16) & 255) * f)));
  const g = Math.min(255, Math.max(0, Math.round(((n >> 8) & 255) * f)));
  const b = Math.min(255, Math.max(0, Math.round((n & 255) * f)));
  return `rgb(${r},${g},${b})`;
}

/** Vlastní návrh vlajky z editoru. Pozice/velikost loga jsou relativní k boxu vlajky. */
export type FlagDesign = {
  bgColor: string;
  logoDataUrl?: string | null;
  /** střed loga, 0–1 */
  logoX: number;
  logoY: number;
  /** šířka loga jako podíl šířky vlajky, 0–1 */
  logoScale: number;
};

export const DEFAULT_DESIGN: FlagDesign = { bgColor: "#ffe701", logoDataUrl: null, logoX: 0.55, logoY: 0.4, logoScale: 0.55 };

export type FlagTextureOptions = {
  shape: FlagShape;
  color?: string;
  hs?: boolean;
  sleeveColor?: "black" | "white";
  logo?: HTMLImageElement | null;
  /** Bílá zaoblená plocha pod logem — logo pak funguje i na tmavé/syté látce. */
  logoPlate?: boolean;
  /** Vlastní vykreslení plochy vlajky (např. náhled z editoru). Kreslí se ořezané do tvaru. */
  drawDesign?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
};

/** Bílý zaoblený podklad s měkkým stínem, vycentrovaný pod logem. */
function drawLogoPlate(ctx: CanvasRenderingContext2D, cx: number, cy: number, lw: number, lh: number) {
  const padX = lw * 0.1;
  const padY = Math.max(lh * 0.16, lw * 0.05);
  const w = lw + padX * 2;
  const h = lh + padY * 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.22)";
  ctx.shadowBlur = w * 0.05;
  ctx.shadowOffsetY = h * 0.04;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(cx - w / 2, cy - h / 2, w, h, Math.min(w, h) * 0.16);
  ctx.fill();
  ctx.restore();
}

export const TEXTURE_H = 1180; // celé plátno
export const FLAG_H = 1024; // výška vlajky na plátně, zbytek dole je pahýl tyče

/** Nakreslí vlajku (+ tunel a pahýl tyče) do canvasu. Vrací canvas použitelný jako WebGL textura. */
export function drawFlagCanvas(opts: FlagTextureOptions, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { shape, color = "#c9ccd1", hs = false, sleeveColor = "black", logo, logoPlate = false, drawDesign } = opts;
  const fw = Math.round(FLAG_H * SHAPE_ASPECT[shape]);
  const c = canvas ?? document.createElement("canvas");
  c.width = fw;
  c.height = TEXTURE_H;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, c.width, c.height);

  const outline = new Path2D(flagPathD(shape, fw, FLAG_H));
  const leading = new Path2D(leadingPathD(shape, fw, FLAG_H));

  // pahýl tyče pod vlajkou
  ctx.fillStyle = "#26262a";
  ctx.fillRect(0, FLAG_H - 6, Math.max(7, fw * 0.024), TEXTURE_H - FLAG_H + 6);

  // plocha vlajky
  ctx.fillStyle = color;
  ctx.fill(outline);

  // vlastní design / logo — ořezané do tvaru
  ctx.save();
  ctx.clip(outline);
  if (drawDesign) drawDesign(ctx, fw, FLAG_H);
  if (logo) {
    const maxW = fw * 0.62;
    const maxH = FLAG_H * 0.3;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * s;
    const lh = logo.height * s;
    if (logoPlate) drawLogoPlate(ctx, fw * 0.55, FLAG_H * 0.42, lw, lh);
    ctx.drawImage(logo, fw * 0.55 - lw / 2, FLAG_H * 0.42 - lh / 2, lw, lh);
  }

  // tunel podél náběžné hrany
  ctx.lineWidth = fw * 0.07;
  ctx.strokeStyle = hs ? (sleeveColor === "black" ? "#1c1c1f" : "#f4f4f2") : shade(color, 0.82);
  ctx.stroke(leading);

  // prošití — čárkovaná linka uvnitř tunelu
  ctx.lineWidth = Math.max(2, fw * 0.008);
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = hs && sleeveColor === "white" ? "#c9c9c6" : "rgba(255,255,255,0.85)";
  ctx.stroke(leading);
  ctx.setLineDash([]);
  ctx.restore();

  return c;
}

export type ClassicFlagTextureOptions = {
  color?: string;
  logo?: HTMLImageElement | null;
  logoPlate?: boolean;
};

/**
 * Klasická obdélníková vlajka na žerdi (dlaždice „Vlajky na zakázku").
 * Žerď s kulovou hlavicí vlevo, tunel podél náběžné hrany, látka doprava.
 * Vrací canvas použitelný jako WebGL textura pro FlagWave (varianta classic).
 */
export function drawClassicFlagCanvas(opts: ClassicFlagTextureOptions, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const { color = "#ffe701", logo, logoPlate = false } = opts;
  const W = 1500;
  const H = 1000;
  const c = canvas ?? document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  ctx.clearRect(0, 0, W, H);

  const poleW = 30;
  const flagX = poleW;
  const flagY = 64;
  const flagH = H - flagY - 64;
  const flagW = W - flagX;

  // žerď — válcový gradient + kulová hlavice
  const poleGrad = ctx.createLinearGradient(0, 0, poleW, 0);
  poleGrad.addColorStop(0, "#2c2c30");
  poleGrad.addColorStop(0.35, "#6a6b72");
  poleGrad.addColorStop(0.55, "#4a4b51");
  poleGrad.addColorStop(1, "#242428");
  ctx.fillStyle = poleGrad;
  ctx.beginPath();
  ctx.roundRect(1, 34, poleW - 2, H - 34, [10, 10, 0, 0]);
  ctx.fill();
  const ballGrad = ctx.createRadialGradient(poleW * 0.36, 22, 3, poleW * 0.5, 27, 24);
  ballGrad.addColorStop(0, "#9a9ba2");
  ballGrad.addColorStop(1, "#3a3a3f");
  ctx.fillStyle = ballGrad;
  ctx.beginPath();
  ctx.arc(poleW * 0.5, 27, 21, 0, Math.PI * 2);
  ctx.fill();

  // látka vlajky
  ctx.fillStyle = color;
  ctx.fillRect(flagX, flagY, flagW, flagH);

  // tunel podél žerdi + prošití
  const sleeveW = flagW * 0.05;
  ctx.fillStyle = shade(color, 0.82);
  ctx.fillRect(flagX, flagY, sleeveW, flagH);
  ctx.lineWidth = Math.max(2, flagW * 0.004);
  ctx.setLineDash([18, 14]);
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(flagX + sleeveW * 0.8, flagY + 6);
  ctx.lineTo(flagX + sleeveW * 0.8, flagY + flagH - 6);
  ctx.stroke();
  ctx.setLineDash([]);

  // obvodový lem — dvojité prošití látky po okraji
  ctx.lineWidth = Math.max(2, flagW * 0.0035);
  ctx.strokeStyle = shade(color, 0.88);
  ctx.strokeRect(flagX + sleeveW + 10, flagY + 10, flagW - sleeveW - 20, flagH - 20);

  // logo na bílém podkladu, vycentrované ve volné ploše
  if (logo) {
    const cx = flagX + sleeveW + (flagW - sleeveW) * 0.5;
    const cy = flagY + flagH * 0.5;
    const maxW = flagW * 0.44;
    const maxH = flagH * 0.42;
    const s = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * s;
    const lh = logo.height * s;
    if (logoPlate) drawLogoPlate(ctx, cx, cy, lw, lh);
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
  }

  return c;
}

/** Vykreslí uložený návrh (pozadí + logo) do plochy vlajky — pro FlagWave.drawDesign i editor. */
export function designPainter(design: FlagDesign, logoImg: HTMLImageElement | null) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    ctx.fillStyle = design.bgColor;
    ctx.fillRect(0, 0, w, h);
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      const lw = w * design.logoScale;
      const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
      ctx.drawImage(logoImg, design.logoX * w - lw / 2, design.logoY * h - lh / 2, lw, lh);
    }
  };
}
