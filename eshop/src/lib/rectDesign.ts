// Obdélníkový návrh (vlajky na zakázku, bannery) — stejný model jako FlagDesign,
// ale kreslí se do poměru stran zadaného rozměru, bez tvaru plážové vlajky.

import type { FlagDesign } from "./flagShapes";

export type RectDesign = FlagDesign;

export const DEFAULT_RECT_DESIGN: RectDesign = {
  bgColor: "#ffffff",
  logoDataUrl: null,
  logoIsPdf: false,
  logoX: 0.5,
  logoY: 0.5,
  logoScale: 0.45,
  logoRotation: 0,
};

const MAX_EDGE = 900;

/** Rozměry canvasu podle cm — delší strana max MAX_EDGE px. */
export function rectCanvasSize(widthCm: number, heightCm: number) {
  const w = Math.max(1, widthCm);
  const h = Math.max(1, heightCm);
  const scale = MAX_EDGE / Math.max(w, h);
  return {
    width: Math.max(40, Math.round(w * scale)),
    height: Math.max(40, Math.round(h * scale)),
  };
}

export function rectDesignPainter(design: RectDesign, logoImg: HTMLImageElement | null) {
  return (ctx: CanvasRenderingContext2D, w: number, h: number) => {
    if (!design.logoDataUrl || design.logoIsPdf || !logoImg || !logoImg.complete || logoImg.naturalWidth <= 0) {
      return;
    }
    const lw = w * design.logoScale;
    const lh = lw * (logoImg.naturalHeight / logoImg.naturalWidth);
    const cx = design.logoX * w;
    const cy = design.logoY * h;
    const rot = ((design.logoRotation || 0) * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(rot);
    ctx.drawImage(logoImg, -lw / 2, -lh / 2, lw, lh);
    ctx.restore();
  };
}

export function drawRectCanvas(
  opts: {
    widthCm: number;
    heightCm: number;
    color: string;
    drawDesign?: (ctx: CanvasRenderingContext2D, w: number, h: number) => void;
  },
  target?: HTMLCanvasElement
): HTMLCanvasElement {
  const { width, height } = rectCanvasSize(opts.widthCm, opts.heightCm);
  const canvas = target ?? document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = opts.color || "#ffffff";
  ctx.fillRect(0, 0, width, height);
  opts.drawDesign?.(ctx, width, height);
  // jemný okraj — ať je plátno vidět i na bílém pozadí editoru
  ctx.strokeStyle = "rgba(8, 8, 10, 0.12)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, width - 2, height - 2);
  return canvas;
}

export function makeRectThumb(
  design: RectDesign,
  logoImg: HTMLImageElement | null,
  widthCm: number,
  heightCm: number
): string | null {
  try {
    const full = drawRectCanvas({
      widthCm,
      heightCm,
      color: design.bgColor || "#ffffff",
      drawDesign: rectDesignPainter(design, logoImg),
    });
    return full.toDataURL("image/png");
  } catch {
    return null;
  }
}
