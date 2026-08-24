// Sdílený loader českého fontu (s diakritikou) pro PDF generátory (faktura, vizualizace).
const FONT_URLS = {
  reg: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  bold: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
};

let fontBytesCache: { reg: ArrayBuffer; bold: ArrayBuffer } | null = null;

export async function loadCzechFontBytes() {
  if (fontBytesCache) return fontBytesCache;
  const [reg, bold] = await Promise.all([
    fetch(FONT_URLS.reg).then((r) => r.arrayBuffer()),
    fetch(FONT_URLS.bold).then((r) => r.arrayBuffer()),
  ]);
  fontBytesCache = { reg, bold };
  return fontBytesCache;
}
