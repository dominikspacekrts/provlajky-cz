// Server-side port of buildClientPdfBytes() from the old app.js (lines ~3453-3600) —
// PDF vizualizace/cenové nabídky posílaná zákazníkovi ("Odeslat vizualizaci").
// Rozdíl oproti staré appce: místo živého kompozitování návrhu na fotku-mockup
// (browser canvas, green-screen šablony) se použije design.thumb, který si
// konfigurátor na eshopu uloží už jako hotový PNG náhled tvaru vlajky/banneru —
// jinak je layout (hlavička s logem, název, obrázky pod sebou s popiskem,
// cenová tabulka, patička) stejný.
import { readFile } from "node:fs/promises";
import path from "node:path";
import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFImage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { computeOrderTotals, customerLabel, fmtMoney, isBanner } from "@/lib/domain";
import { loadCzechFontBytes } from "./font";
import type { Order, OrderItem } from "@/lib/types";

function dataUrlToBytes(dataUrl: string): { bytes: Buffer; isPng: boolean } | null {
  const m = /^data:image\/(png|jpeg|jpg);base64,(.*)$/.exec(dataUrl);
  if (!m) return null;
  return { bytes: Buffer.from(m[2], "base64"), isPng: m[1] === "png" };
}

export async function generateVisualPdf(order: Order, items: OrderItem[]): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let font: PDFFont;
  let fontB: PDFFont;
  let sanitize = (s: unknown) => String(s == null ? "" : s);
  try {
    const bytes = await loadCzechFontBytes();
    pdfDoc.registerFontkit(fontkit);
    font = await pdfDoc.embedFont(bytes.reg, { subset: true });
    fontB = await pdfDoc.embedFont(bytes.bold, { subset: true });
  } catch {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
    sanitize = (s: unknown) =>
      String(s == null ? "" : s)
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "");
  }
  const T = (s: unknown) => sanitize(s);
  const cur = order.currency || "CZK";
  const money = (n: number) => T(fmtMoney(n, cur as "CZK" | "EUR"));

  let logoEmbedded: PDFImage | null = null;
  try {
    const logoBytes = await readFile(path.join(process.cwd(), "public", "logo", "logo-tmave.png"));
    logoEmbedded = await pdfDoc.embedPng(logoBytes);
  } catch {
    // logo je jen ozdoba hlavičky — bez něj PDF pořád vygenerujeme.
  }

  const A4w = 595.28,
    A4h = 841.89,
    M = 45;
  const line = rgb(0.87, 0.88, 0.9);
  const ink = rgb(0.1, 0.1, 0.1);
  const grey = rgb(0.5, 0.52, 0.55);
  const contentW = A4w - M * 2;

  let page = pdfDoc.addPage([A4w, A4h]);
  let y = A4h - M;
  const newPage = () => {
    page = pdfDoc.addPage([A4w, A4h]);
    y = A4h - M;
  };

  // ---- Hlavička: logo vlevo, web vpravo ----
  if (logoEmbedded) {
    const lh = 32,
      lw = (logoEmbedded.width * lh) / logoEmbedded.height;
    page.drawImage(logoEmbedded, { x: M, y: y - lh, width: lw, height: lh });
  }
  const web = T("provlajky.cz");
  page.drawText(web, { x: A4w - M - fontB.widthOfTextAtSize(web, 11), y: y - 11, size: 11, font: fontB, color: ink });
  const mail = T("info@provlajky.cz");
  page.drawText(mail, { x: A4w - M - font.widthOfTextAtSize(mail, 8.5), y: y - 24, size: 8.5, font, color: grey });
  y -= 44;
  page.drawLine({ start: { x: M, y }, end: { x: A4w - M, y }, thickness: 0.5, color: line });
  y -= 22;

  // ---- Nadpis ----
  const onlyBanners = items.length > 0 && items.every(isBanner);
  const title = T(onlyBanners ? "NÁVRH GRAFIKY" : "NÁVRH PLÁŽOVÉ VLAJKY");
  page.drawText(title, { x: (A4w - fontB.widthOfTextAtSize(title, 15)) / 2, y, size: 15, font: fontB, color: ink });
  y -= 16;
  const sub = T(customerLabel(order) + ` · objednávka č. ${order.order_number || "—"}`);
  page.drawText(sub, { x: (A4w - font.widthOfTextAtSize(sub, 9)) / 2, y, size: 9, font, color: grey });
  y -= 22;

  // ---- Obrázky návrhů pod sebou ----
  type Visual = { img: PDFImage; item: OrderItem };
  const visuals: Visual[] = [];
  for (const item of items) {
    const decoded = item.design?.thumb ? dataUrlToBytes(item.design.thumb) : null;
    if (!decoded) continue;
    const img = decoded.isPng ? await pdfDoc.embedPng(decoded.bytes) : await pdfDoc.embedJpg(decoded.bytes);
    visuals.push({ img, item });
  }

  if (visuals.length > 0) {
    const capGap = 14,
      blockGap = 20,
      bottomReserve = M + 24;
    const avail = y - bottomReserve;
    const perBlock = capGap + blockGap;
    const fitCount = Math.max(1, Math.min(visuals.length, Math.floor((avail + blockGap) / (275 + perBlock))) || 1);
    const maxImgH = Math.min(320, (avail - (fitCount - 1) * blockGap) / fitCount - capGap);
    for (const v of visuals) {
      const scale = Math.min(contentW / v.img.width, maxImgH / v.img.height);
      const w = v.img.width * scale,
        h = v.img.height * scale;
      if (y - h - capGap < bottomReserve - 2) newPage();
      const ix = (A4w - w) / 2;
      page.drawImage(v.img, { x: ix, y: y - h, width: w, height: h });
      const it = v.item;
      const cap = T(
        isBanner(it)
          ? `PVC banner ${it.width_cm || 0}×${it.height_cm || 0} cm · ${it.qty} ks`
          : `${it.shape} · ${it.size} · ${it.qty} ks`
      );
      page.drawText(cap, { x: (A4w - font.widthOfTextAtSize(cap, 8.5)) / 2, y: y - h - capGap, size: 8.5, font, color: grey });
      y -= h + capGap + blockGap;
    }
  }

  // ---- Cenová tabulka (celá objednávka) ----
  const priceNeed = (items.length + 6) * 15 + 70;
  if (y - priceNeed < M + 40) newPage();
  page.drawLine({ start: { x: M, y }, end: { x: A4w - M, y }, thickness: 0.5, color: line });
  y -= 16;
  page.drawText(T("CENOVÁ NABÍDKA"), { x: M, y, size: 8, font: fontB, color: grey });
  y -= 16;

  const pRow = (label: string, val: string, bold = false) => {
    const f = bold ? fontB : font;
    const sz = bold ? 10.5 : 9.5;
    page.drawText(T(label), { x: M, y, size: sz, font: f, color: bold ? ink : grey });
    const vt = T(val);
    page.drawText(vt, { x: A4w - M - f.widthOfTextAtSize(vt, sz), y, size: sz, font: f, color: ink });
    if (!bold) y -= 15;
  };

  const tt = computeOrderTotals(order, items);
  for (const it of items) {
    const lineEx = (it.unit_price || 0) * (it.qty || 1);
    const label = isBanner(it)
      ? `PVC banner ${it.width_cm || 0}×${it.height_cm || 0} cm  ×  ${it.qty} ks`
      : `Plážová vlajka tvar ${it.shape}, vel. ${it.size}  ×  ${it.qty} ks`;
    pRow(label, money(lineEx));
  }
  if (order.discount_pct) pRow(`Sleva ${order.discount_pct} %`, "- " + money(tt.discountEx));
  if (tt.shipEx > 0) pRow("Doprava (bez DPH)", money(tt.shipEx));
  pRow("Cena bez DPH", money(tt.totalEx));
  pRow("DPH celkem", money(tt.totalVat));
  y -= 4;
  page.drawLine({ start: { x: M, y }, end: { x: A4w - M, y }, thickness: 0.6, color: ink });
  y -= 16;
  pRow("Celkem k úhradě (vč. DPH)", money(tt.grand), true);

  // ---- Patička ----
  const fY = M + 14;
  page.drawLine({ start: { x: M, y: fY + 18 }, end: { x: A4w - M, y: fY + 18 }, thickness: 0.4, color: line });
  page.drawText(T("Nezávazná cenová nabídka · platí 10 dní"), { x: M, y: fY, size: 7.5, font, color: grey });
  const dt = T(new Date().toLocaleDateString("cs-CZ"));
  page.drawText(dt, { x: A4w - M - font.widthOfTextAtSize(dt, 7.5), y: fY, size: 7.5, font, color: grey });

  return pdfDoc.save();
}
