"use client";

/*
 * Dotazník spokojenosti z mailu (/hodnoceni/<token>). Záměrně na jednu
 * obrazovku a postupně: nejdřív jen hvězdičky, zbytek se odkryje až po
 * kliknutí — kdo chce dát jen známku, má hotovo dvěma kliknutími.
 * Fotky se zmenší v prohlížeči (fotky z telefonu mívají 5–10 MB) a nahrávají
 * se hned po výběru, takže zákazník vidí náhled i průběh.
 */

import Link from "next/link";
import { useId, useRef, useState } from "react";
import type { ReviewInvite } from "@/lib/reviews";

const MAX_PHOTOS = 6;
const MAX_BODY = 2000;
const MAX_SIDE = 2000;

const RATING_LABELS = ["", "Nespokojeni", "Mohlo to být lepší", "V pořádku", "Spokojeni", "Nadšení"];

type Photo = {
  key: string;
  preview: string;
  path: string | null;
  error: string | null;
};

// Zmenší fotku na max. 2000 px delší strany a převede na JPEG. Díky tomu
// projde i fotka z iPhonu (HEIC Safari při výběru převede sám) a požadavek
// se vejde do limitu serverové funkce.
async function downscale(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Soubor není fotka."));
      el.src = url;
    });
    const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.naturalWidth * scale);
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Fotku se nepodařilo zpracovat.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

function Star({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={filled ? "is-on" : undefined}>
      <path d="M12 2.8l2.83 5.73 6.32.92-4.57 4.46 1.08 6.3L12 17.24l-5.66 2.97 1.08-6.3-4.57-4.46 6.32-.92z" />
    </svg>
  );
}

export default function ReviewForm({ token, invite }: { token: string; invite: ReviewInvite }) {
  const uid = useId();
  const fileInput = useRef<HTMLInputElement>(null);

  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [body, setBody] = useState("");
  const [authorName, setAuthorName] = useState(invite.defaultName);
  const [authorRole, setAuthorRole] = useState(invite.defaultRole);
  const [allowPublish, setAllowPublish] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(invite.status === "submitted");

  const shown = hover || rating;
  const uploading = photos.some((p) => !p.path && !p.error);

  async function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const files = Array.from(list).filter((f) => f.type.startsWith("image/") || /\.(heic|heif)$/i.test(f.name));
    const free = MAX_PHOTOS - photos.filter((p) => !p.error).length;
    if (files.length > free) setError(`Přidat jde nejvýš ${MAX_PHOTOS} fotek.`);
    else setError(null);

    for (const file of files.slice(0, Math.max(0, free))) {
      const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`;
      const preview = URL.createObjectURL(file);
      setPhotos((cur) => [...cur, { key, preview, path: null, error: null }]);
      const update = (patch: Partial<Photo>) =>
        setPhotos((cur) => cur.map((p) => (p.key === key ? { ...p, ...patch } : p)));
      try {
        const dataUrl = await downscale(file);
        const res = await fetch(`/api/hodnoceni/${token}/foto`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ dataUrl }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok || !json.path) throw new Error(json.error || "Nahrání se nepovedlo.");
        update({ path: json.path });
      } catch (e) {
        update({ error: e instanceof Error ? e.message : "Nahrání se nepovedlo." });
      }
    }
  }

  function removePhoto(key: string) {
    setPhotos((cur) => {
      const gone = cur.find((p) => p.key === key);
      if (gone) URL.revokeObjectURL(gone.preview);
      return cur.filter((p) => p.key !== key);
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!rating) {
      setError("Vyberte prosím počet hvězdiček.");
      return;
    }
    if (uploading) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`/api/hodnoceni/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          body,
          authorName,
          authorRole,
          allowPublish,
          photos: photos.map((p) => p.path).filter(Boolean),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.status === 409) {
        setDone(true);
        return;
      }
      if (!res.ok) throw new Error(json.error || "Hodnocení se nepodařilo odeslat.");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Hodnocení se nepodařilo odeslat.");
    } finally {
      setSending(false);
    }
  }

  if (done) {
    const finalRating = rating || invite.rating || 0;
    return (
      <div className="rv-done">
        <div className="rv-done-stars" aria-label={finalRating ? `${finalRating} z 5 hvězdiček` : undefined}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Star key={n} filled={n <= finalRating} />
          ))}
        </div>
        <h1>Děkujeme za hodnocení</h1>
        <p className="muted">
          {finalRating && finalRating <= 3
            ? "Mrzí nás, že nebylo všechno podle představ. Vaši zpětnou vazbu si projdeme a ozveme se."
            : "Moc nám pomáhá — díky ní víme, co děláme dobře, a ostatní zákazníci se snáz rozhodují."}
        </p>
        <p style={{ marginTop: 30 }}>
          <Link href="/" className="btn-outline">
            Na úvodní stránku
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="rv-form" onSubmit={submit} noValidate>
      <header className="rv-head">
        <p className="rv-eyebrow">
          {invite.orderNumber ? `Objednávka č. ${invite.orderNumber}` : "Vaše objednávka"}
        </p>
        <h1>Jak jste spokojeni?</h1>
        {invite.items.length > 0 && <p className="rv-items">{invite.items.join(" · ")}</p>}
      </header>

      <fieldset className="rv-block rv-rating">
        <legend className="rv-label">Celkové hodnocení</legend>
        <div className="rv-stars" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label key={n} className="rv-star" onMouseEnter={() => setHover(n)}>
              <input
                type="radio"
                name={`${uid}-rating`}
                value={n}
                checked={rating === n}
                onChange={() => {
                  setRating(n);
                  setError(null);
                }}
                aria-label={`${n} z 5 — ${RATING_LABELS[n]}`}
              />
              <Star filled={n <= shown} />
            </label>
          ))}
        </div>
        <p className="rv-rating-label" aria-live="polite">
          {shown ? RATING_LABELS[shown] : "Klikněte na hvězdičku"}
        </p>
      </fieldset>

      <div className={`rv-rest${rating ? " is-open" : ""}`} aria-hidden={rating ? undefined : true}>
        <div className="rv-rest-inner">
          <div className="rv-block">
            <label className="rv-label" htmlFor={`${uid}-body`}>
              {rating && rating <= 3 ? "Co bychom měli zlepšit?" : "Co se vám líbilo?"} <span className="rv-optional">nepovinné</span>
            </label>
            <textarea
              id={`${uid}-body`}
              value={body}
              maxLength={MAX_BODY}
              rows={5}
              onChange={(e) => setBody(e.target.value)}
              placeholder={
                rating && rating <= 3
                  ? "Napište nám, co nebylo podle vašich představ — pomůže nám to."
                  : "Třeba kvalita tisku, jak rychle to dorazilo, nebo jak vlajky obstály na akci…"
              }
              tabIndex={rating ? undefined : -1}
            />
            {body.length > MAX_BODY - 200 && (
              <p className="rv-hint">
                {body.length} / {MAX_BODY}
              </p>
            )}
          </div>

          <div className="rv-block">
            <span className="rv-label">
              Fotky z akce <span className="rv-optional">nepovinné</span>
            </span>
            <p className="rv-hint">Ukažte, jak vaše vlajky nebo stan vypadají v akci. Až {MAX_PHOTOS} fotek.</p>
            <div
              className={`rv-photos${dragOver ? " is-drag" : ""}`}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                addFiles(e.dataTransfer.files);
              }}
            >
              {photos.map((p) => (
                <div key={p.key} className={`rv-photo${p.error ? " is-error" : ""}${!p.path && !p.error ? " is-loading" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.preview} alt="" />
                  {!p.path && !p.error && <span className="rv-photo-spinner" aria-label="Nahrávám" />}
                  {p.error && <span className="rv-photo-error">{p.error}</span>}
                  <button type="button" className="rv-photo-remove" onClick={() => removePhoto(p.key)} aria-label="Odebrat fotku">
                    ×
                  </button>
                </div>
              ))}
              {photos.filter((p) => !p.error).length < MAX_PHOTOS && (
                <button
                  type="button"
                  className="rv-photo-add"
                  onClick={() => fileInput.current?.click()}
                  tabIndex={rating ? undefined : -1}
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                    <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  <span>{photos.length ? "Další fotka" : "Přidat fotky"}</span>
                </button>
              )}
            </div>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              multiple
              hidden
              onChange={(e) => {
                addFiles(e.target.files);
                e.target.value = "";
              }}
            />
          </div>

          <div className="rv-block rv-author">
            <label className="rv-field">
              <span className="rv-label">Podpis</span>
              <input
                value={authorName}
                maxLength={80}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Jan Novák"
                autoComplete="name"
                tabIndex={rating ? undefined : -1}
              />
            </label>
            <label className="rv-field">
              <span className="rv-label">
                Firma nebo akce <span className="rv-optional">nepovinné</span>
              </span>
              <input
                value={authorRole}
                maxLength={80}
                onChange={(e) => setAuthorRole(e.target.value)}
                placeholder="Název firmy, klubu nebo akce"
                autoComplete="organization"
                tabIndex={rating ? undefined : -1}
              />
            </label>
          </div>

          <label className={`rv-consent${allowPublish ? " is-on" : ""}`}>
            <input
              type="checkbox"
              checked={allowPublish}
              onChange={(e) => setAllowPublish(e.target.checked)}
              tabIndex={rating ? undefined : -1}
            />
            <span>
              <strong>Hodnocení můžete zveřejnit na provlajky.cz</strong>
              <small>
                Zveřejníme hvězdičky, text, fotky a podpis výše — nikdy e-mail ani telefon. Souhlas můžete kdykoli
                odvolat na info@provlajky.cz.
              </small>
            </span>
          </label>
        </div>
      </div>

      {error && (
        <p className="rv-error" role="alert">
          {error}
        </p>
      )}

      <div className="rv-actions">
        <button type="submit" className="btn-yellow" disabled={!rating || sending || uploading}>
          {sending ? "Odesílám…" : uploading ? "Nahrávám fotky…" : "Odeslat hodnocení"}
        </button>
      </div>
    </form>
  );
}
