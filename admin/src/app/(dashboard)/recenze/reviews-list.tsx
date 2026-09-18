"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteReview, setReviewCover, setReviewPublished, updateReviewAuthor } from "@/lib/actions/reviews";
import { reviewPhotoUrl } from "@/lib/domain";
import type { Order, Review } from "@/lib/types";

export type ReviewRow = Review & { order: Pick<Order, "order_number" | "customer"> | null };

type Filter = "all" | "submitted" | "published" | "invited";

const FILTERS: { key: Filter; label: string }[] = [
  { key: "submitted", label: "Vyplněné" },
  { key: "published", label: "Na webu" },
  { key: "invited", label: "Čeká na zákazníka" },
  { key: "all", label: "Vše" },
];

function fmtDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString("cs-CZ") : "—";
}

export default function ReviewsList({ rows }: { rows: ReviewRow[] }) {
  const [filter, setFilter] = useState<Filter>("submitted");
  const submitted = rows.filter((r) => r.status === "submitted");
  const avg = submitted.length ? submitted.reduce((sum, r) => sum + (r.rating || 0), 0) / submitted.length : 0;

  const visible = rows.filter((r) =>
    filter === "all"
      ? true
      : filter === "published"
        ? r.published
        : filter === "invited"
          ? r.status === "invited"
          : r.status === "submitted"
  );

  return (
    <div style={{ marginTop: 18 }}>
      <div className="orders-toolbar">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`btn mini${filter === f.key ? " active" : ""}`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
        <span className="muted" style={{ fontSize: 13 }}>
          {submitted.length > 0
            ? `Průměr ${avg.toLocaleString("cs-CZ", { maximumFractionDigits: 1 })} ★ z ${submitted.length} hodnocení · na webu ${rows.filter((r) => r.published).length}`
            : `Zatím žádné vyplněné hodnocení · odesláno ${rows.length}`}
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {visible.map((r) => (
          <ReviewCard key={r.id} review={r} />
        ))}
        {visible.length === 0 && <p className="muted">Nic tu není.</p>}
      </div>
    </div>
  );
}

function ReviewCard({ review: r }: { review: ReviewRow }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cover = r.cover_photo || r.photos[0] || null;
  const b = r.order?.customer?.billing;

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn().catch(() => ({ ok: false, error: "Akce se nepovedla." }));
      if (!res.ok) setError(res.error || "Akce se nepovedla.");
    });
  }

  const orderLink = r.order_id ? (
    <Link href={`/orders/${r.order_id}`}>č. {r.order?.order_number || "—"}</Link>
  ) : (
    <span>smazaná objednávka</span>
  );

  if (r.status === "invited") {
    return (
      <div className="addr-block row-between" style={{ opacity: isPending ? 0.6 : 1 }}>
        <span>
          Objednávka {orderLink} · {b?.company || b?.name || "—"}{" "}
          <span className="muted" style={{ fontSize: 13 }}>
            — odkaz odeslán {fmtDate(r.invited_at)}, zatím nevyplněno
          </span>
        </span>
        <button
          type="button"
          className="btn mini danger"
          disabled={isPending}
          onClick={() => confirm("Zrušit pozvánku? Odkaz v mailu přestane fungovat.") && run(() => deleteReview(r.id))}
        >
          Zrušit
        </button>
      </div>
    );
  }

  return (
    <div className="addr-block" style={{ opacity: isPending ? 0.6 : 1 }}>
      <div className="row-between" style={{ alignItems: "flex-start", flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: 20, color: "#eab308", letterSpacing: 2 }} aria-label={`${r.rating} z 5`}>
            {"★".repeat(r.rating || 0)}
            <span style={{ color: "#d1d5db" }}>{"★".repeat(5 - (r.rating || 0))}</span>
          </div>
          <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            Objednávka {orderLink} · vyplněno {fmtDate(r.submitted_at)}
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          {r.allow_publish ? (
            <span
              className={`paid-toggle${r.published ? " on" : ""}`}
              onClick={() => !isPending && run(() => setReviewPublished(r.id, !r.published))}
            >
              <span className="toggle-switch" />
              {r.published ? "Na webu" : "Nezveřejněno"}
            </span>
          ) : (
            <span className="status-badge" style={{ background: "#f3f4f6", color: "#6b7280" }} title="Zákazník nezaškrtl souhlas se zveřejněním">
              Bez souhlasu se zveřejněním
            </span>
          )}
          <button
            type="button"
            className="btn mini danger"
            disabled={isPending}
            onClick={() => confirm("Smazat recenzi i s fotkami?") && run(() => deleteReview(r.id))}
          >
            Smazat
          </button>
        </div>
      </div>

      {r.body ? (
        <p style={{ whiteSpace: "pre-wrap", margin: "12px 0" }}>{r.body}</p>
      ) : (
        <p className="muted" style={{ margin: "12px 0" }}>
          (bez textu)
        </p>
      )}

      <AuthorFields review={r} disabled={isPending} onSave={(fields) => run(() => updateReviewAuthor(r.id, fields))} />

      {r.photos.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>
            Fotky — kliknutím vybereš tu, která se ukáže na homepage
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {r.photos.map((p) => (
              <div key={p} style={{ position: "relative" }}>
                <button
                  type="button"
                  onClick={() => run(() => setReviewCover(r.id, p))}
                  disabled={isPending}
                  title={p === cover ? "Fotka na homepage" : "Použít na homepage"}
                  style={{
                    padding: 0,
                    border: p === cover ? "3px solid #eab308" : "3px solid transparent",
                    borderRadius: 8,
                    background: "none",
                    cursor: "pointer",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={reviewPhotoUrl(p)} alt="" style={{ width: 120, height: 90, objectFit: "cover", display: "block", borderRadius: 5 }} />
                </button>
                <a
                  href={reviewPhotoUrl(p)}
                  target="_blank"
                  rel="noreferrer"
                  className="btn mini"
                  style={{ position: "absolute", right: 6, bottom: 6, padding: "1px 6px" }}
                  title="Otevřít v plné velikosti"
                >
                  ↗
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && <div style={{ color: "#dc2626", fontSize: 13, marginTop: 8 }}>{error}</div>}
    </div>
  );
}

function AuthorFields({
  review,
  disabled,
  onSave,
}: {
  review: ReviewRow;
  disabled: boolean;
  onSave: (fields: { author_name: string; author_role: string }) => void;
}) {
  const [name, setName] = useState(review.author_name || "");
  const [role, setRole] = useState(review.author_role || "");
  const dirty = name !== (review.author_name || "") || role !== (review.author_role || "");

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "flex-end", flexWrap: "wrap" }}>
      <label className="field" style={{ fontSize: 12 }}>
        Podpis
        <input value={name} onChange={(e) => setName(e.target.value)} disabled={disabled} style={{ height: 32, padding: "0 8px" }} />
      </label>
      <label className="field" style={{ fontSize: 12 }}>
        Firma / akce
        <input value={role} onChange={(e) => setRole(e.target.value)} disabled={disabled} style={{ height: 32, padding: "0 8px" }} />
      </label>
      {dirty && (
        <button type="button" className="btn mini" disabled={disabled} onClick={() => onSave({ author_name: name, author_role: role })}>
          Uložit podpis
        </button>
      )}
    </div>
  );
}
