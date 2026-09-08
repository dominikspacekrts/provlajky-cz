"use client";

// Živý náhled nůžkového stanu: produktová fotka a přes ni předgenerované
// vrstvy stěn (viz src/lib/tentLayers.ts).
//
// Všechny vrstvy jsou v DOM pořád a jen se prolínají průhledností. Díky tomu
// se načtou hned s náhledem a přepnutí stěny je okamžité, bez probliknutí.
// Dohromady mají kolem 120 kB.
//
// Každá vrstva je stejně velký obrázek roztažený na celý rámeček, takže se
// všechny deformují úplně stejně — náhled proto sedí i v tom případě, že
// rodič rámečku vnutí jiný poměr stran.

import { FAR_SIDES, NEAR_SIDES, type SideKey, type StageSides, type TentLayers, type WallType } from "@/lib/tentLayers";

const TYPES: WallType[] = ["full", "half"];

export default function TentStage({
  layers,
  sides,
  alt,
}: {
  layers: TentLayers;
  sides: StageSides;
  alt: string;
}) {
  const wall = (side: SideKey) =>
    TYPES.map((type) => (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        key={`${side}-${type}`}
        src={layers.wall(side, type)}
        alt=""
        aria-hidden="true"
        className="tent-stage-layer"
        style={{ opacity: sides[side]?.type === type ? 1 : 0 }}
      />
    ));

  return (
    <div className="tent-stage">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={layers.photo} alt={alt} className="tent-stage-base" />
      {FAR_SIDES.map(wall)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={layers.posts} alt="" aria-hidden="true" className="tent-stage-layer" style={{ opacity: 1 }} />
      {NEAR_SIDES.map(wall)}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={layers.roof} alt="" aria-hidden="true" className="tent-stage-layer" style={{ opacity: 1 }} />
    </div>
  );
}
