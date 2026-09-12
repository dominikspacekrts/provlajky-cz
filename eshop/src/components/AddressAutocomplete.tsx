"use client";

// Obaluje input "Ulice a č.p." — při psaní (debounce, min. 3 znaky) našeptá
// reálné adresy z /api/address-suggest. Vybraná položka doplní i město a PSČ
// přes onSelect. Bez nakonfigurovaného MAPY_API_KEY na serveru vrátí endpoint
// vždycky prázdný seznam, takže input funguje jako obyčejné textové pole —
// ruční zadání je vždycky možné, tohle je jen pomůcka navrch.

import { useEffect, useId, useRef, useState } from "react";
import type { AddressSuggestion } from "@/lib/address-suggest";

export default function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  id,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  onSelect: (suggestion: AddressSuggestion) => void;
  id?: string;
  placeholder?: string;
}) {
  const [items, setItems] = useState<AddressSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const listId = `${id ?? generatedId}-suggest`;
  const ready = value.trim().length >= 3;
  const showList = open && ready && items.length > 0;

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (value.trim().length < 3) return;
    debounceRef.current = setTimeout(() => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      fetch(`/api/address-suggest?q=${encodeURIComponent(value.trim())}`, { signal: controller.signal })
        .then((r) => r.json())
        .then((data: { items: AddressSuggestion[] }) => {
          setItems(data.items ?? []);
          setOpen((data.items ?? []).length > 0);
          setActiveIdx(-1);
        })
        .catch(() => {});
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, [value]);

  // Klik mimo pole/dropdown ho zavře.
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  function pick(item: AddressSuggestion) {
    onSelect(item);
    setOpen(false);
    setItems([]);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showList) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault();
      pick(items[activeIdx]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div className="address-autocomplete" ref={boxRef}>
      <input
        id={id}
        type="text"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => items.length > 0 && ready && setOpen(true)}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && activeIdx >= 0 ? `${listId}-${activeIdx}` : undefined}
      />
      {showList && (
        <ul id={listId} className="address-suggest-list" role="listbox">
          {items.map((item, i) => (
            <li
              key={`${item.street}-${item.city}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === activeIdx}
              className={i === activeIdx ? "is-active" : undefined}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(item);
              }}
              onMouseEnter={() => setActiveIdx(i)}
            >
              {item.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
