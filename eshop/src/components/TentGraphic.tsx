"use client";

// Kreslený nůžkový (pop-up) stan — čistě SVG, bez závislostí. Parametrický:
// mění se podle velikosti (hloubka bočnice), konfigurace stěn a počtu potištěných
// stran. Logo PROVLAJKY sedí na bočnici na bílém „plate" — stejně jako logo na
// dlaždici s vlajkou (FlagWave + logoPlate). Používá se pro náhled každé varianty.

import type { TentWalls } from "@/lib/types";

export type TentGraphicProps = {
  size?: string | null; // např. "3×6 m" — druhý rozměr určuje hloubku bočnice
  walls?: TentWalls; // none = jen rám+strop, half = poloviční stěny, full = celé stěny
  printSides?: "single" | "double";
  logoSrc?: string;
  roofColor?: string;
  className?: string;
};

// Vytáhne [šířka, hloubka] v metrech z labelu velikosti ("3×4,5 m" → [3, 4.5]).
function parseSize(size?: string | null): [number, number] {
  if (!size) return [3, 3];
  const nums = size
    .replace(/,/g, ".")
    .match(/\d+(\.\d+)?/g);
  if (!nums || nums.length < 2) return [3, 3];
  return [parseFloat(nums[0]), parseFloat(nums[1])];
}

export default function TentGraphic({
  size,
  walls = "full",
  printSides = "single",
  logoSrc = "/logo/logo-tmave.png",
  roofColor = "#ffe701",
  className = "",
}: TentGraphicProps) {
  const [, depth] = parseSize(size);
  // Hloubka bočnice roste s druhým rozměrem (3 m = základ, 6 m = nejdelší).
  const dz = Math.max(48, Math.min(120, 40 + depth * 12));

  // Přední eave (okap) — pevná frontáž; back se odvíjí od hloubky (perspektiva).
  const FLx = 46,
    FRx = 208,
    eaveY = 120;
  const BRx = FRx + dz,
    BLx = FLx + dz,
    backY = eaveY - dz * 0.42;
  const apex: [number, number] = [(FLx + FRx) / 2 + dz * 0.5, 28];

  const groundY = 216;
  const legLen = groundY - eaveY;
  const backGroundY = groundY - dz * 0.42;
  const val = 15; // výška valance (lemu)

  // Poloviční stěny visí ODSPODU (nízká zábrana) — horní pruh zůstává otevřený,
  // takže je přes něj vidět celá zadní stěna s logem.
  const skirtTop = eaveY + legLen * 0.52; // horní hrana poloviční přední stěny
  const skirtTopBack = backY + legLen * 0.52;

  // Logo na přední stěně (celé stěny) — vycentrované.
  const fullWallH = groundY - eaveY;
  const fPlateW = (FRx - FLx) * 0.66;
  const fPlateH = Math.min(fullWallH * 0.4, fPlateW * 0.32);
  const fPlateX = FLx + ((FRx - FLx) - fPlateW) / 2;
  const fPlateY = eaveY + val + (fullWallH - val - fPlateH) / 2;

  // Logo na zadní celé stěně (poloviční konfigurace) — v otevřeném pruhu nad skirtem.
  const bandTop = Math.max(backY + val + 4, eaveY + 6);
  const bandBot = skirtTop;
  const bCx = (BLx + BRx) / 2;
  const bPlateH = Math.min(38, (bandBot - bandTop) * 0.74);
  const bPlateW = Math.min((BRx - BLx) * 0.6, bPlateH * 3.1);
  const bPlateX = bCx - bPlateW / 2;
  const bPlateY = bandTop + ((bandBot - bandTop) - bPlateH) / 2;

  const logoPlate = (x: number, y: number, w: number, h: number) => (
    <>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#ffffff" stroke="#eceef1" strokeWidth="1" />
      <image
        href={logoSrc}
        x={x + w * 0.08}
        y={y + h * 0.16}
        width={w * 0.84}
        height={h * 0.68}
        preserveAspectRatio="xMidYMid meet"
      />
    </>
  );

  return (
    <svg viewBox="0 0 330 240" className={`tentgraphic ${className}`} role="img" aria-label={`Nůžkový stan ${size ?? ""}`.trim()}>
      <defs>
        <linearGradient id="tg-roof" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={roofColor} />
          <stop offset="1" stopColor={roofColor} stopOpacity="0.86" />
        </linearGradient>
      </defs>

      <ellipse cx={FLx + dz * 0.5 + 60} cy={groundY + 8} rx={120} ry={11} fill="rgba(0,0,0,0.16)" />

      {/* zadní celá stěna — „1 celá vzadu" (viditelná u poloviční konfigurace) */}
      {walls === "half" && (
        <polygon
          points={`${BLx},${backY} ${BRx},${backY} ${BRx},${backGroundY} ${BLx},${backGroundY}`}
          fill="#eef0f3"
          stroke="#dfe2e7"
          strokeWidth="1"
        />
      )}

      {/* nohy konstrukce (boční tyče) */}
      <g stroke="#c2c6cc" strokeWidth="4" strokeLinecap="round">
        <line x1={FLx} y1={eaveY} x2={FLx} y2={groundY} />
        <line x1={FRx} y1={eaveY} x2={FRx} y2={groundY} />
        <line x1={BRx} y1={backY} x2={BRx} y2={backGroundY} />
      </g>

      {/* nůžková konstrukce „X" — jen když nejsou stěny */}
      {walls === "none" && (
        <g stroke="#d3d7dd" strokeWidth="3" strokeLinecap="round" opacity="0.9">
          <line x1={FLx} y1={eaveY + 6} x2={FRx} y2={groundY - 6} />
          <line x1={FRx} y1={eaveY + 6} x2={FLx} y2={groundY - 6} />
          <line x1={FRx} y1={eaveY + 6} x2={BRx} y2={backGroundY - 6} />
          <line x1={BRx} y1={backY + 6} x2={FRx} y2={groundY - 6} />
        </g>
      )}

      {/* CELÉ STĚNY — boční + přední na plnou výšku */}
      {walls === "full" && (
        <>
          <polygon
            points={`${FRx},${eaveY} ${BRx},${backY} ${BRx},${backGroundY} ${FRx},${groundY}`}
            fill="#eef0f3"
            stroke="#dfe2e7"
            strokeWidth="1"
          />
          <polygon
            points={`${FLx},${eaveY} ${FRx},${eaveY} ${FRx},${groundY} ${FLx},${groundY}`}
            fill="#ffffff"
            stroke="#e2e5ea"
            strokeWidth="1"
          />
        </>
      )}

      {/* POLOVIČNÍ STĚNY — nízké zábrany odspodu (boční + přední) */}
      {walls === "half" && (
        <>
          <polygon
            points={`${FRx},${skirtTop} ${BRx},${skirtTopBack} ${BRx},${backGroundY} ${FRx},${groundY}`}
            fill="#e7eaee"
            stroke="#dfe2e7"
            strokeWidth="1"
          />
          <polygon
            points={`${FLx},${skirtTop} ${FRx},${skirtTop} ${FRx},${groundY} ${FLx},${groundY}`}
            fill="#ffffff"
            stroke="#e2e5ea"
            strokeWidth="1"
          />
        </>
      )}

      {/* střecha — dvě viditelné plochy pyramidy */}
      <polygon points={`${apex[0]},${apex[1]} ${FLx},${eaveY} ${FRx},${eaveY}`} fill="url(#tg-roof)" stroke="#e6cf00" strokeWidth="1" />
      <polygon points={`${apex[0]},${apex[1]} ${FRx},${eaveY} ${BRx},${backY}`} fill={roofColor} fillOpacity="0.72" stroke="#e6cf00" strokeWidth="1" />

      {/* valance (lem) pod okapem */}
      <rect x={FLx} y={eaveY} width={FRx - FLx} height={val} fill={roofColor} stroke="#e6cf00" strokeWidth="1" />
      <polygon
        points={`${FRx},${eaveY} ${BRx},${backY} ${BRx},${backY + val} ${FRx},${eaveY + val}`}
        fill={roofColor}
        fillOpacity="0.72"
        stroke="#e6cf00"
        strokeWidth="1"
      />

      {/* logo — vždy navrch, aby bylo čisté */}
      {walls === "none" && (
        <>
          <rect x={FLx + 24} y={eaveY + 1} width={FRx - FLx - 48} height={val - 3} rx={2} fill="#ffffff" />
          <image href={logoSrc} x={FLx + 30} y={eaveY + 1} width={FRx - FLx - 60} height={val - 3} preserveAspectRatio="xMidYMid meet" />
        </>
      )}
      {walls === "full" && logoPlate(fPlateX, fPlateY, fPlateW, fPlateH)}
      {walls === "half" && logoPlate(bPlateX, bPlateY, bPlateW, bPlateH)}

      {walls !== "none" && printSides === "double" && (
        <text x={FRx + (BRx - FRx) / 2} y={backGroundY + 14} textAnchor="middle" fontSize="9" fill="#9aa0a8">
          oboustranný potisk
        </text>
      )}
    </svg>
  );
}
