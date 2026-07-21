"use client";

// Nůžkový (pop-up) stan, který se skládá a rozkládá. Nůžková konstrukce se
// stahuje k sobě a střecha klesá, pak se stan zase rozloží — v nekonečné smyčce.
// Na hover se přehraje rychleji (třída .fast). Čistě SVG + CSS, bez závislostí.

export default function TentFold({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 260 210" className={`tentfold ${className}`} role="img" aria-label="Skládací nůžkový stan">
      <ellipse className="tf-shadow" cx="130" cy="200" rx="96" ry="8" />
      <g className="tf-tent">
        {/* nůžková konstrukce — dvě „X" mezi nohama */}
        <g className="tf-frame">
          <line x1="40" y1="96" x2="40" y2="196" />
          <line x1="130" y1="96" x2="130" y2="196" />
          <line x1="220" y1="96" x2="220" y2="196" />
          <line className="tf-x" x1="40" y1="104" x2="130" y2="180" />
          <line className="tf-x" x1="130" y1="104" x2="40" y2="180" />
          <line className="tf-x" x1="130" y1="104" x2="220" y2="180" />
          <line className="tf-x" x1="220" y1="104" x2="130" y2="180" />
        </g>
        {/* stříška */}
        <g className="tf-canopy">
          <polygon className="tf-roof" points="130,16 232,92 28,92" />
          <polygon className="tf-roof-shade" points="130,16 232,92 130,92" />
          <rect className="tf-valance" x="28" y="92" width="204" height="22" rx="3" />
          <image
            href="/logo/logo-tmave.png"
            x="92"
            y="95"
            width="76"
            height="16"
            preserveAspectRatio="xMidYMid meet"
          />
        </g>
      </g>
    </svg>
  );
}
