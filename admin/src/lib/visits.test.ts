import assert from "node:assert/strict";
import test from "node:test";
import { aggregateVisits, type CartAdd, type VisitRow } from "./visits";

const now = new Date("2026-10-19T12:00:00+02:00");

function row(partial: Partial<VisitRow>): VisitRow {
  return {
    created_at: "2026-10-19T10:00:00.000Z",
    path: "/",
    source: "google",
    country: "CZ",
    visitor_id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa",
    session_id: "s1",
    duration_sec: 0,
    ...partial,
  };
}

test("pages rank by total visible time, not view count", () => {
  const stats = aggregateVisits(
    [
      row({ path: "/stany", duration_sec: 2, visitor_id: "v1" }),
      row({ path: "/stany", duration_sec: 2, visitor_id: "v2" }),
      row({ path: "/stany", duration_sec: 2, visitor_id: "v3" }),
      row({ path: "/stany", duration_sec: 2, visitor_id: "v4" }),
      row({ path: "/produkt/plazove-vlajky", duration_sec: 40, visitor_id: "v5" }),
    ],
    "den",
    now,
  );
  assert.equal(stats.pages[0].path, "/produkt/plazove-vlajky");
  assert.equal(stats.pages[0].totalSec, 40);
  assert.equal(stats.pages[0].bounceCount, 0);
  assert.equal(stats.pages[1].path, "/stany");
  assert.equal(stats.pages[1].bounceCount, 4);
});

test("people list marks cart adders and keeps everyone else", () => {
  const cart: CartAdd[] = [
    {
      created_at: "2026-10-19T10:05:00.000Z",
      visitor_id: "v-cart",
      session_id: "s2",
      product_name: "Plážové vlajky",
      product_slug: "plazove-vlajky",
      variant: "M",
      qty: 1,
      path: "/produkt/plazove-vlajky",
    },
  ];
  const stats = aggregateVisits(
    [
      row({ visitor_id: "v-cart", path: "/produkt/plazove-vlajky", duration_sec: 20 }),
      row({ visitor_id: "v-look", path: "/stany", duration_sec: 4 }),
    ],
    "den",
    now,
    cart,
  );
  assert.equal(stats.people.length, 2);
  const withCart = stats.people.find((person) => person.id === "v-cart");
  const without = stats.people.find((person) => person.id === "v-look");
  assert.equal(withCart?.hasCart, true);
  assert.equal(withCart?.cart[0]?.name, "Plážové vlajky");
  assert.equal(without?.hasCart, false);
  assert.equal(without?.pages[0]?.path, "/stany");
});
