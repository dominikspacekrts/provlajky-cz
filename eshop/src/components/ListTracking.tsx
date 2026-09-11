"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { type AnalyticsItem, trackSelectItem, trackViewItemList } from "@/lib/analytics";

// Výpis kategorie i detail produktu jsou server komponenty — eventy se proto
// odpalují z těchhle drobných klientských obalů.

export function ViewItemList({ items, listName }: { items: AnalyticsItem[]; listName: string }) {
  const sent = useRef<string | null>(null);

  useEffect(() => {
    // Klíč hlídá dvojí spuštění efektu ve StrictMode i návrat na stejný výpis.
    const key = `${listName}:${items.map((i) => i.item_id).join(",")}`;
    if (sent.current === key) return;
    sent.current = key;
    trackViewItemList(items, listName);
  }, [items, listName]);

  return null;
}

export function SelectItemLink({
  item,
  listName,
  href,
  className,
  children,
}: {
  item: AnalyticsItem;
  listName: string;
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={className} onClick={() => trackSelectItem(item, listName)}>
      {children}
    </Link>
  );
}
