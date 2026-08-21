import { TENT_CATEGORIES, type ProductCategory } from "./types";

// Tři hlavní produktové rodiny pro asymetrický "prasklinový" hero na /nova2.
// Zbylé kategorie (vlajky na zakázku, příslušenství) zůstávají dostupné
// v mřížce pod herem a v patičce — hero ukazuje jen tři vstupní body.
export type HeroGroup = {
  id: string;
  title: string;
  href: string;
  categories: ProductCategory[];
  image: string;
};

export const HERO_GROUPS: HeroGroup[] = [
  {
    id: "vlajky",
    title: "Plážové vlajky",
    href: "/plazove-vlajky",
    categories: ["plazove-vlajky"],
    image: "/hero/plazove-vlajky.jpg",
  },
  {
    id: "stany",
    title: "Nafukovací a nůžkové stany",
    href: "/stany",
    categories: TENT_CATEGORIES,
    image: "/hero/nafukovaci-stan.jpg",
  },
  {
    id: "bannery",
    title: "Bannery a meshe",
    href: "/pvc-bannery",
    categories: ["pvc-bannery"],
    image: "/hero/bannery.jpg",
  },
];
