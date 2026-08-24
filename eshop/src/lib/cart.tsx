"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { CartLine } from "./types";

// Košík se persistuje do IndexedDB, ne localStorage — jedna položka s vlastním
// nahraným logem snadno zabere přes 1 MB (base64 návrh + náhled), a
// localStorage má tvrdý strop kolem 5 MB na origin. Pár vlajek v košíku pak
// setItem() spolehlivě přehodí přes kvótu a "Přidat do košíku" přestane
// fungovat bez jakékoli chybové hlášky. IndexedDB má o řády větší kvótu a je
// pro tohle přímo určená.
const DB_NAME = "provlajky-cart-db";
const STORE = "cart";
const KEY = "lines";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

type CartContextValue = {
  lines: CartLine[];
  addLine: (line: Omit<CartLine, "id">) => void;
  updateQty: (id: string, qty: number) => void;
  removeLine: (id: string) => void;
  clear: () => void;
  count: number;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>([]);
  const loaded = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const stored = await idbGet<CartLine[]>(KEY);
        if (stored) setLines(stored);
      } catch {
        // IndexedDB nedostupná (soukromé prohlížení apod.) — košík jede jen v paměti.
      }
      loaded.current = true;
    })();
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    // Selhání persistence nesmí shodit UI ani ztratit právě přidanou položku —
    // stav v Reactu je vždy zdroj pravdy, uložení na disk je jen best-effort.
    idbSet(KEY, lines).catch(() => {});
  }, [lines]);

  function addLine(line: Omit<CartLine, "id">) {
    setLines((cur) => [...cur, { ...line, id: crypto.randomUUID() }]);
  }

  function updateQty(id: string, qty: number) {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, qty: Math.max(1, qty) } : l)));
  }

  function removeLine(id: string) {
    setLines((cur) => cur.filter((l) => l.id !== id));
  }

  function clear() {
    setLines([]);
  }

  const count = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <CartContext.Provider value={{ lines, addLine, updateQty, removeLine, clear, count }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
