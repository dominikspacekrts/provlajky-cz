"use client";

import { useRouter } from "next/navigation";

export default function BackButton() {
  const router = useRouter();
  return (
    <button className="btn back-btn" onClick={() => router.back()} aria-label="Zpět" title="Zpět">
      ←
    </button>
  );
}
