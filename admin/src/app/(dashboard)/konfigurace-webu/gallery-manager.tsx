"use client";

import { useState, useTransition } from "react";
import { addGalleryPhoto, deleteGalleryPhoto, type GalleryCategory } from "@/lib/actions/gallery";
import type { GalleryRow } from "./page";

const SECTIONS: { category: GalleryCategory; label: string }[] = [
  { category: "plazove-vlajky", label: "Plážové vlajky" },
  { category: "vlajky-na-zakazku", label: "Vlajky na zakázku" },
];

export default function GalleryManager({ rows }: { rows: GalleryRow[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 32, marginTop: 20 }}>
      {SECTIONS.map((s) => (
        <GallerySection key={s.category} category={s.category} label={s.label} photos={rows.filter((r) => r.category === s.category)} />
      ))}
    </div>
  );
}

function GallerySection({ category, label, photos }: { category: GalleryCategory; label: string; photos: GalleryRow[] }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function addFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result !== "string") return;
        startTransition(async () => {
          try {
            await addGalleryPhoto(category, reader.result as string);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Nahrání se nepovedlo.");
          }
        });
      };
      reader.readAsDataURL(file);
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      try {
        await deleteGalleryPhoto(id);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Smazání se nepovedlo.");
      }
    });
  }

  return (
    <section>
      <h3 style={{ marginBottom: 4 }}>{label}</h3>
      <label className="btn" style={{ display: "inline-block", cursor: "pointer", marginTop: 8 }}>
        {isPending ? "Nahrávám…" : "+ Nahrát fotky"}
        <input type="file" accept="image/*" multiple hidden disabled={isPending} onChange={(e) => addFiles(e.target.files)} />
      </label>
      {error && <p style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</p>}

      {photos.length === 0 ? (
        <p className="muted" style={{ marginTop: 12 }}>Zatím žádné fotky.</p>
      ) : (
        <div className="product-image-preview-row" style={{ marginTop: 12 }}>
          {photos.map((p) => (
            <div key={p.id} className="product-image-preview">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.image} alt="" />
              <button type="button" className="product-image-remove" onClick={() => remove(p.id)} disabled={isPending} title="Smazat">
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
