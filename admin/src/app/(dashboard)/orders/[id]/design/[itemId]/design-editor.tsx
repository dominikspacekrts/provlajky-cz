"use client";

import dynamic from "next/dynamic";
import type { OrderItem } from "@/lib/types";

// Konva touches `window` at import time, so this must never render on the
// server — load it client-only.
const DesignEditorCanvas = dynamic(() => import("./design-editor-canvas"), {
  ssr: false,
  loading: () => <p className="muted">Načítám editor…</p>,
});

export default function DesignEditor({ orderId, item }: { orderId: string; item: OrderItem }) {
  return <DesignEditorCanvas orderId={orderId} item={item} />;
}
