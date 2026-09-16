"use client";

// Volba grafiky u zakázkové výroby: buď vlastní grafika (editor / hotová data),
// nebo grafický návrh zdarma — zákazník jen přiloží logo (nebo ho pošle
// e-mailem později). Do košíku jde položka v obou případech i bez grafiky.
// U stanů jsou u vlastní grafiky navíc ke stažení podklady (šablony) pro grafika.

import { useState, type ReactNode } from "react";
import { DownloadMark, UploadMark } from "@/components/Icons";
import {
  FREE_DESIGN_LOGO_MAX_BYTES,
  type ArtworkMode,
  type DesignTemplate,
  type FreeDesignLogo,
} from "@/lib/designTemplates";

const LOGO_ACCEPT = "image/png,image/jpeg,image/webp,image/svg+xml,.svg,application/pdf,.pdf";

export default function ArtworkChoice({
  mode,
  onModeChange,
  logo,
  onLogoChange,
  own,
  templates = [],
}: {
  mode: ArtworkMode;
  onModeChange: (next: ArtworkMode) => void;
  logo: FreeDesignLogo | null;
  onLogoChange: (next: FreeDesignLogo | null) => void;
  /** Obsah pro „vlastní grafiku" — tlačítko editoru, nápověda apod. */
  own: ReactNode;
  templates?: DesignTemplate[];
}) {
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (file.size > FREE_DESIGN_LOGO_MAX_BYTES) {
      setError("Soubor je větší než 3 MB — pošlete ho po objednávce na info@provlajky.cz.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onLogoChange({ dataUrl: String(reader.result), name: file.name });
    reader.readAsDataURL(file);
  }

  return (
    <div className="fc-artwork">
      <div className="option-label">Grafika</div>
      <div className="option-row">
        <button type="button" className={`option-chip${mode === "own" ? " active" : ""}`} onClick={() => onModeChange("own")}>
          Mám vlastní grafiku
        </button>
        <button type="button" className={`option-chip${mode === "free" ? " active" : ""}`} onClick={() => onModeChange("free")}>
          Grafický návrh zdarma
        </button>
      </div>

      {mode === "own" ? (
        <>
          {own}
          {templates.length > 0 && (
            <div className="fc-artwork-templates">
              {templates.map((t) => (
                <a key={t.href} className="btn-outline fc-artwork-download" href={t.href} download>
                  <DownloadMark className="fc-artwork-download-icon" />
                  {t.label}
                </a>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="fc-artwork-free">
          <p className="fc-artwork-text">
            Stačí nám poslat logo. Návrh připravíme zdarma a před výrobou vám ho pošleme ke schválení.
          </p>
          {logo ? (
            <div className="fc-artwork-file">
              <span className="fc-artwork-file-name">{logo.name}</span>
              <button type="button" className="fc-artwork-remove" onClick={() => onLogoChange(null)}>
                Odebrat
              </button>
            </div>
          ) : (
            <label className="editor-upload">
              <input type="file" accept={LOGO_ACCEPT} onChange={(e) => handleFile(e.target.files?.[0])} hidden />
              <UploadMark className="editor-upload-icon" />
              <span>Přidat logo (PNG, JPG, SVG nebo PDF)</span>
            </label>
          )}
          {error && <p className="fc-artwork-error">{error}</p>}
          {!logo && !error && (
            <p className="fc-artwork-hint">Nepovinné — logo můžete poslat i po objednávce na info@provlajky.cz.</p>
          )}
        </div>
      )}
    </div>
  );
}
