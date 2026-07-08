"use client";

import { createContext, useContext, useEffect, useState } from "react";
import type { CartLine } from "./types";

const STORAGE_KEY = "provlajky-cart";

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
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time hydration from localStorage on mount
      if (raw) setLines(JSON.parse(raw));
    } catch {
      // corrupt/blocked storage — start with an empty cart
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
  }, [lines, loaded]);

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
