"use client";

// Sdílí fotku, která je zrovna aktivní v hero slideshow na homepage, s další stránkou po kliknutí
// na dlaždici — díky tomu se pozadí při přechodu neztrácí, jen na něj plynule naváže cílová stránka.

export const HERO_PHOTOS = [
  "/fotky/foto-01.jpg",
  "/fotky/foto-02.jpg",
  "/fotky/foto-03.jpg",
  "/fotky/foto-04.jpg",
];

const KEY = "provlajky-hero-photo";

export function setLastHeroPhoto(src: string) {
  try {
    sessionStorage.setItem(KEY, src);
  } catch {
    // privátní režim / zakázané úložiště — přechod prostě bude bez navazující fotky
  }
}

export function getLastHeroPhoto(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
}
