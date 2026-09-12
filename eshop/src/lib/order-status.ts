/** Zákaznické labely stavů objednávky (eshop „Můj účet“). */

const CUSTOMER_STATUS_LABELS: Record<string, string> = {
  new: "Přijato",
  pending: "Přijato",
  processing: "Připravujeme",
  invoiced: "Čekáme na platbu",
  paid: "Ve výrobě",
  awaiting_delivery: "Ve výrobě",
  "paid-awaiting": "Ve výrobě",
  shipped: "Odesláno",
  "paid-delivering": "Odesláno",
  completed: "Dokončeno",
  "on-hold": "Pozdržena",
  cancelled: "Zrušena",
  refunded: "Vrácena",
  failed: "Neúspěšná",
};

export function customerStatusLabel(status: string): string {
  return CUSTOMER_STATUS_LABELS[status] || status || "—";
}

export function customerStatusTone(
  status: string,
): "neutral" | "progress" | "wait" | "done" | "warn" | "bad" {
  if (status === "completed") return "done";
  if (status === "shipped" || status === "paid-delivering") return "progress";
  if (status === "invoiced" || status === "on-hold") return "wait";
  if (status === "cancelled" || status === "failed" || status === "refunded") return "bad";
  if (status === "new" || status === "pending") return "neutral";
  return "progress";
}
