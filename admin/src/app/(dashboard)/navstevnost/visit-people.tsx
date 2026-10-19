"use client";

import { useState } from "react";
import type { VisitPersonView } from "@/lib/visits";

export function VisitPeople({ people }: { people: VisitPersonView[] }) {
  const [open, setOpen] = useState<string | null>(null);

  if (people.length === 0) {
    return <p className="muted">V tomhle období zatím žádný návštěvník.</p>;
  }

  return (
    <div className="visit-people">
      {people.map((person) => {
        const expanded = open === person.id;
        return (
          <div key={person.id} className={`visit-person${person.hasCart ? " has-cart" : ""}`}>
            <button
              type="button"
              className="visit-person-btn"
              aria-expanded={expanded}
              onClick={() => setOpen(expanded ? null : person.id)}
            >
              <code title={person.id}>{person.shortId}</code>
              <span>{person.sourceLabel}</span>
              <span>{person.lastLabel}</span>
              <span>{person.totalLabel}</span>
              <span className="visit-cart-flag">{person.hasCart ? "košík" : ""}</span>
            </button>
            {expanded && (
              <div className="visit-person-detail">
                <p className="muted">Kde byli</p>
                {person.pages.length === 0 ? (
                  <p className="muted">Žádné zobrazení stránky.</p>
                ) : (
                  <ul>
                    {person.pages.map((page, index) => (
                      <li key={`${page.when}-${page.path}-${index}`}>
                        <span>{page.when}</span>
                        <code>{page.path}</code>
                        <strong>{page.time}</strong>
                      </li>
                    ))}
                  </ul>
                )}
                <p className="muted">Košík</p>
                {person.cart.length === 0 ? (
                  <p className="muted">Nic nevložili.</p>
                ) : (
                  <ul>
                    {person.cart.map((item, index) => (
                      <li key={`${item.when}-${item.label}-${index}`}>
                        <span>{item.when}</span>
                        <span>{item.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
