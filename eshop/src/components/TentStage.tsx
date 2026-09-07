"use client";

// Živý náhled nůžkového stanu: produktová fotka + stěny dokreslené přes ni
// jako perspektivní čtyřúhelníky. Rohy bere z tentGeometry (naměřeno přímo
// ze snímku), takže stěna sedí na konstrukci na pixel a překreslí se hned,
// jak zákazník v konfigurátoru klikne — bez animací, bez načítání.
//
// Blízké stěny (přední s logem a levá) jsou schválně mírně průhledné, aby
// přes ně byla vidět konstrukce a stan nezůstal jen bílá placka. Vzdálené
// dvě jsou průhlednější ještě víc — čtou se pak jako stěna „za" rámem.

import type { Pt, TentPhotoGeometry } from "@/lib/tentGeometry";

export type WallType = "half" | "full";
export type SideKey = "front" | "back" | "left" | "right";
export type StageSides = Record<SideKey, { type: WallType } | null>;

// Kde poloviční stěna začíná — podíl výšky nohy měřeno od okapu dolů.
const HALF_TOP = 0.48;
// Kreslí se odzadu dopředu, aby blízké stěny překryly ty vzdálené.
const DRAW_ORDER: SideKey[] = ["back", "right", "left", "front"];

type FaceSpec = { a: Pt; b: Pt; ga: number; gb: number; near: boolean; shade: string };

function faces(g: TentPhotoGeometry): Record<SideKey, FaceSpec> {
  const { L, R, F, B } = g.eave;
  const f = g.foot;
  return {
    // přední = strana s logem, vpravo od nejbližšího rohu
    front: { a: F, b: R, ga: f.F, gb: f.R, near: true, shade: "#f4f4f2" },
    left: { a: L, b: F, ga: f.L, gb: f.F, near: true, shade: "#e4e4e1" },
    back: { a: L, b: B, ga: f.L, gb: f.B, near: false, shade: "#ececea" },
    right: { a: B, b: R, ga: f.B, gb: f.R, near: false, shade: "#e8e8e5" },
  };
}

// Body čtyřúhelníku stěny ve viewBoxu 0..1000. U poloviční stěny se horní
// hrana posune dolů po svislé hraně nohy.
function wallPoints(spec: FaceSpec, type: WallType): string {
  const t = type === "half" ? HALF_TOP : 0;
  const ax = spec.a[0] * 1000;
  const bx = spec.b[0] * 1000;
  const ay = (spec.a[1] + t * (spec.ga - spec.a[1])) * 1000;
  const by = (spec.b[1] + t * (spec.gb - spec.b[1])) * 1000;
  const ag = spec.ga * 1000;
  const bg = spec.gb * 1000;
  return `${ax},${ay} ${bx},${by} ${bx},${bg} ${ax},${ag}`;
}

export default function TentStage({
  geometry,
  sides,
  alt,
}: {
  geometry: TentPhotoGeometry;
  sides: StageSides;
  alt: string;
}) {
  const spec = faces(geometry);

  return (
    <div className="tent-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={geometry.image} alt={alt} className="tent-stage-photo" />
      <svg
        className="tent-stage-walls"
        viewBox="0 0 1000 1000"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          {DRAW_ORDER.map((key) => (
            <linearGradient key={key} id={`tent-wall-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={spec[key].shade} stopOpacity="0.96" />
              <stop offset="1" stopColor={spec[key].shade} stopOpacity="0.82" />
            </linearGradient>
          ))}
        </defs>
        {DRAW_ORDER.map((key) => {
          const side = sides[key];
          if (!side) return null;
          const s = spec[key];
          return (
            <polygon
              key={key}
              points={wallPoints(s, side.type)}
              fill={`url(#tent-wall-${key})`}
              stroke="#c9c9c4"
              strokeWidth={s.near ? 1.6 : 1.1}
              vectorEffect="non-scaling-stroke"
              opacity={s.near ? 0.86 : 0.55}
            />
          );
        })}
      </svg>
    </div>
  );
}
