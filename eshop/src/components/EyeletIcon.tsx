"use client";

// Jednoduché line-art ikony typů uchycení vlajky (offline, bez fotek). Když je
// u typu dodaná reálná fotka (public/vlajky/ocka/*), komponenta ji preferuje.

import { useEffect, useRef, useState } from "react";
import type { EyeletGlyph } from "@/lib/flagOptions";

const S = { fill: "none", stroke: "#374151", strokeWidth: 5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

function Glyph({ glyph }: { glyph: EyeletGlyph }) {
  switch (glyph) {
    case "tunnel":
      return (
        <>
          <rect x={20} y={20} width={60} height={60} rx={6} {...S} />
          <path d="M32 20 v60" {...S} />
        </>
      );
    case "strap-carabiner":
      return (
        <>
          <rect x={22} y={26} width={30} height={48} rx={4} {...S} />
          <path d="M52 50 h16" {...S} />
          <circle cx={74} cy={50} r={8} {...S} />
        </>
      );
    case "d-ring":
      return (
        <>
          <path d="M40 26 h18 a20 24 0 0 1 0 48 h-18 z" {...S} />
          <path d="M30 30 v40" {...S} />
        </>
      );
    case "grommet":
      return (
        <>
          <rect x={20} y={24} width={60} height={52} rx={6} {...S} />
          <circle cx={50} cy={50} r={13} {...S} />
          <circle cx={50} cy={50} r={5} {...S} />
        </>
      );
    case "windtracker":
      return (
        <>
          <rect x={20} y={22} width={60} height={56} rx={8} {...S} />
          <path d="M34 22 v56" {...S} />
          <path d="M46 34 q10 16 0 32" {...S} />
        </>
      );
    case "carabiner":
      return (
        <>
          <path d="M40 24 a20 24 0 1 0 0 52" {...S} />
          <path d="M40 24 h6 M40 76 h6" {...S} />
          <path d="M60 34 l14 8 -14 8" fill="#f97316" stroke="#f97316" strokeWidth={4} strokeLinejoin="round" />
        </>
      );
    case "hook":
      return (
        <>
          <path d="M50 22 v16" {...S} />
          <path d="M50 38 a16 16 0 1 1 -14 24" {...S} />
        </>
      );
    case "loop":
      return (
        <>
          <path d="M30 26 v34 a20 20 0 0 0 40 0 v-34" {...S} />
          <path d="M24 26 h12 M64 26 h12" {...S} />
        </>
      );
    case "hem":
      return (
        <>
          <rect x={20} y={24} width={60} height={52} rx={6} {...S} />
          <path d="M20 34 h60 M20 66 h60" stroke="#9ca3af" strokeWidth={3} strokeDasharray="6 5" fill="none" />
        </>
      );
    default:
      return <rect x={20} y={20} width={60} height={60} rx={6} {...S} />;
  }
}

export default function EyeletIcon({ glyph, photo, alt }: { glyph: EyeletGlyph; photo?: string; alt: string }) {
  const [photoOk, setPhotoOk] = useState(Boolean(photo));
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Chybějící fotku zachytíme i když onError proběhl před hydratací (SSR obrázek).
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setPhotoOk(false);
  }, []);

  if (photo && photoOk) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        ref={imgRef}
        src={photo}
        alt={alt}
        className="eyelet-photo"
        draggable={false}
        onError={() => setPhotoOk(false)}
      />
    );
  }
  return (
    <svg viewBox="0 0 100 100" className="eyelet-glyph" role="img" aria-label={alt}>
      <Glyph glyph={glyph} />
    </svg>
  );
}
