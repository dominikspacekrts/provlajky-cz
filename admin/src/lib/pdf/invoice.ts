// Server-side port of generateInvoicePdf() from the old app.js (lines ~4261-4575).
// Difference from the original: item design thumbnails are not embedded (that required
// browser canvas APIs); everything else (layout, Czech font, QR payment panel, payout
// invoice variant) is ported 1:1 so numbers/wording match exactly.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { fmtMoney, SUPPLIER } from "@/lib/domain";
import { accountToIban, buildSpdString } from "./iban";
import type { Invoice } from "@/lib/types";

const FONT_URLS = {
  reg: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Regular.ttf",
  bold: "https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoSans/NotoSans-Bold.ttf",
};

let fontBytesCache: { reg: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadCzechFontBytes() {
  if (fontBytesCache) return fontBytesCache;
  const [reg, bold] = await Promise.all([
    fetch(FONT_URLS.reg).then((r) => r.arrayBuffer()),
    fetch(FONT_URLS.bold).then((r) => r.arrayBuffer()),
  ]);
  fontBytesCache = { reg, bold };
  return fontBytesCache;
}

async function makePaymentQrPng(inv: Invoice): Promise<Buffer | null> {
  const iban = accountToIban(SUPPLIER.bank);
  if (!iban) return null;
  const amount = inv.kind === "payout" ? inv.amount : inv.totals?.grand;
  const spd = buildSpdString({
    iban,
    amount,
    vs: inv.number,
    msg: "Faktura " + inv.number,
    currency: inv.currency || "CZK",
  });
  try {
    return await QRCode.toBuffer(spd, { type: "png", width: 360, margin: 2 });
  } catch {
    return null;
  }
}

export async function generateInvoicePdf(inv: Invoice): Promise<Uint8Array> {
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
  const W = 595.28,
    H = 841.89,
    M = 52;
  const page = pdfDoc.addPage([W, H]);
  const ink = rgb(0.1, 0.1, 0.1),
    grey = rgb(0.52, 0.54, 0.57),
    light = rgb(0.68, 0.7, 0.73),
    line = rgb(0.87, 0.88, 0.9);
  const cur = inv.currency || "CZK";
  const money = (n: number) => T(fmtMoney(n, cur as "CZK" | "EUR"));
  const rightText = (txt: string, xRight: number, yy: number, f: PDFFont = font, size = 9, col = ink) => {
    const w = f.widthOfTextAtSize(txt, size);
    page.drawText(txt, { x: xRight - w, y: yy, size, font: f, color: col });
  };
  const drawLabel = (txt: string, x: number, yy: number) =>
    page.drawText(T(txt), { x, y: yy, size: 7.5, font: fontB, color: light });
  const contentR = W - M;
  let y = H - M;
  const fmtD = (d: string | null) => (d ? new Date(d).toLocaleDateString("cs-CZ") : "—");

  // ===== PAYOUT INVOICE (partner → ACTUAL PRO, "Administrativa") =====
  if (inv.kind === "payout") {
    const sup = inv.supplier!;
    const cuz = inv.payout_customer!;
    page.drawText(T("Faktura"), { x: M, y: y - 14, size: 24, font: fontB, color: ink });
    page.drawText(T("č. " + inv.number), { x: M, y: y - 30, size: 9, font, color: grey });
    rightText(T(sup.name || sup.person || ""), contentR, y, fontB, 11, ink);
    const supLines = [
      sup.street,
      sup.city,
      (sup.ico ? "IČO " + sup.ico : "") + (sup.dic ? "  ·  DIČ " + sup.dic : ""),
      sup.dic || sup.ico ? "" : "Neplátce DPH",
    ].filter(Boolean);
    supLines.forEach((l, i) => rightText(T(l!), contentR, y - 16 - i * 11, font, 8.5, grey));
    y -= 56;
    page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.6, color: line });
    y -= 22;

    drawLabel("ODBĚRATEL", M, y);
    const cl = [cuz.company, cuz.street, [cuz.psc, cuz.city].filter(Boolean).join(" "), "IČO " + cuz.ico + "   DIČ " + cuz.dic].filter(
      Boolean
    );
    cl.forEach((l, i) =>
      page.drawText(T(l!), { x: M, y: y - 14 - i * 12, size: i === 0 ? 9 : 8.5, font: i === 0 ? fontB : font, color: i === 0 ? ink : grey })
    );
    const meta: [string, string][] = [
      ["Datum vystavení", fmtD(inv.issued)],
      ["Datum splatnosti", fmtD(inv.due)],
      ["Variabilní symbol", inv.number],
    ];
    if (sup.bank) meta.push(["Číslo účtu", sup.bank]);
    drawLabel("PLATEBNÍ ÚDAJE", M + 316, y);
    meta.forEach((m, i) => {
      page.drawText(T(m[0]), { x: M + 316, y: y - 14 - i * 14, size: 8.5, font, color: grey });
      rightText(T(m[1]), contentR, y - 14 - i * 14, fontB, 8.5, ink);
    });
    y -= 14 + Math.max(cl.length, meta.length) * 13 + 30;

    page.drawText(T("Popis"), { x: M, y, size: 8, font: fontB, color: grey });
    rightText(T("Částka"), contentR, y, fontB, 8, grey);
    y -= 8;
    page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.7, color: ink });
    y -= 20;
    page.drawText(T(inv.subject || "Administrativa"), { x: M, y, size: 11, font, color: ink });
    rightText(money(inv.amount || 0), contentR, y, font, 11, ink);
    y -= 14;
    page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.4, color: line });
    y -= 26;
    page.drawText(T("Celkem k úhradě"), { x: 318, y, size: 12, font: fontB, color: ink });
    rightText(money(inv.amount || 0), contentR, y - 1, fontB, 15, ink);
    if (!sup.dic) {
      y -= 22;
      page.drawText(T("Dodavatel není plátcem DPH."), { x: M, y, size: 8.5, font, color: grey });
    }
    const fy = M + 14;
    page.drawLine({ start: { x: M, y: fy + 18 }, end: { x: contentR, y: fy + 18 }, thickness: 0.4, color: line });
    page.drawText(T("Vystaveno za administrativní činnost."), { x: M, y: fy, size: 8, font, color: grey });
    return pdfDoc.save();
  }

  // ---- Header (product invoice) ----
  page.drawText(T("Faktura"), { x: M, y: y - 14, size: 24, font: fontB, color: ink });
  page.drawText(T("č. " + inv.number), { x: M, y: y - 30, size: 9, font, color: grey });
  rightText(T(SUPPLIER.name), contentR, y, fontB, 11, ink);
  [SUPPLIER.street, SUPPLIER.city, "IČO " + SUPPLIER.ico + "  ·  DIČ " + SUPPLIER.dic].forEach((l, i) =>
    rightText(T(l), contentR, y - 16 - i * 11, font, 8.5, grey)
  );
  y -= 52;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.6, color: line });
  y -= 22;

  const col1 = M,
    col2 = M + 158,
    col3 = M + 316;
  const lineH = 12,
    bodySize = 8.5,
    boldSize = 9;

  const c = inv.customer!;
  drawLabel("ODBĚRATEL (FAKTURAČNÍ)", col1, y);
  const billLines = [
    c.company,
    c.name,
    c.street,
    [c.psc, c.city].filter(Boolean).join(" "),
    c.ico ? "IČO: " + c.ico : "",
    c.dic ? "DIČ: " + c.dic : "",
    c.email ? "E-mail: " + c.email : "",
    c.phone ? "Tel: " + c.phone : "",
  ].filter((v): v is string => Boolean(v));
  billLines.forEach((l, i) =>
    page.drawText(T(l), {
      x: col1,
      y: y - 14 - i * lineH,
      size: i === 0 ? boldSize : l.startsWith("E-mail") ? 7.5 : bodySize,
      font: i === 0 ? fontB : font,
      color: i === 0 ? ink : grey,
    })
  );

  const ship = (inv.shipping_customer || {}) as Record<string, string>;
  drawLabel("DORUČOVACÍ ADRESA", col2, y);
  const shipPhone = ship.ship_phone || c.phone;
  const shipLines = [
    ship.ship_company || c.company,
    ship.ship_name || c.name,
    ship.ship_street || c.street,
    [ship.ship_psc || c.psc, ship.ship_city || c.city].filter(Boolean).join(" "),
    shipPhone ? "Tel: " + shipPhone : "",
  ].filter((v): v is string => Boolean(v));
  shipLines.forEach((l, i) =>
    page.drawText(T(l), {
      x: col2,
      y: y - 14 - i * lineH,
      size: i === 0 ? boldSize : bodySize,
      font: i === 0 ? fontB : font,
      color: i === 0 ? ink : grey,
    })
  );

  const meta: [string, string][] = [
    ["Datum vystavení", fmtD(inv.issued)],
    ["Datum zdan. plnění", fmtD(inv.tax_date || inv.issued)],
    ["Datum splatnosti", fmtD(inv.due)],
    ["Variabilní symbol", inv.number],
    ["Forma úhrady", "Převodem"],
  ];
  if (inv.foreign) {
    const iban = accountToIban(SUPPLIER.bank);
    if (iban) meta.push(["IBAN", iban.replace(/(.{4})/g, "$1 ").trim()]);
    if (SUPPLIER.bic) meta.push(["BIC/SWIFT", SUPPLIER.bic]);
  } else if (SUPPLIER.bank) {
    meta.push(["Číslo účtu", SUPPLIER.bank]);
  }
  drawLabel("PLATEBNÍ ÚDAJE", col3, y);
  meta.forEach((m, i) => {
    page.drawText(T(m[0]), { x: col3, y: y - 14 - i * lineH, size: bodySize, font, color: grey });
    rightText(T(m[1]), contentR, y - 14 - i * lineH, fontB, bodySize, ink);
  });

  const infoRows = Math.max(billLines.length, shipLines.length, meta.length);
  y -= 14 + infoRows * lineH + 22;

  const cX = { qty: 286, unit: 348, vat: 392, ex: 450, dph: 498, total: contentR };
  const head = (txt: string, x: number, rightAlign = true) => {
    if (rightAlign) rightText(T(txt), x, y, fontB, 7, grey);
    else page.drawText(T(txt), { x, y, size: 7, font: fontB, color: grey });
  };
  head("Položka", M, false);
  head("Ks", cX.qty);
  head("Cena/ks", cX.unit);
  head("DPH %", cX.vat);
  head("Cena bez DPH", cX.ex);
  head("DPH", cX.dph);
  head("Cena s DPH", cX.total);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.8, color: ink });
  y -= 16;

  const rowH = 20,
    descX = M;
  let sumVat = 0;
  let zebra = false;
  const drawZebra = (h: number) => {
    if (zebra) page.drawRectangle({ x: M - 4, y: y - 9, width: contentR - M + 8, height: h - 4, color: rgb(0.975, 0.978, 0.983) });
    zebra = !zebra;
  };

  for (const it of inv.items) {
    const lineEx = it.unitPrice * it.qty;
    const lineVat = lineEx * (it.vatRate || 0);
    const lineGross = lineEx + lineVat;
    sumVat += lineVat;
    drawZebra(rowH);

    let desc = it.desc;
    while (font.widthOfTextAtSize(T(desc), 8.5) > cX.qty - descX - 8 && desc.length > 8) desc = desc.slice(0, -2);
    page.drawText(T(desc + (desc !== it.desc ? "…" : "")), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T(String(it.qty)), cX.qty, y, font, 8.5, ink);
    rightText(money(it.unitPrice), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round((it.vatRate || 0) * 100) + " %"), cX.vat, y, font, 8.5, grey);
    rightText(money(lineEx), cX.ex, y, font, 8.5, ink);
    rightText(money(lineVat), cX.dph, y, font, 8.5, grey);
    rightText(money(lineGross), cX.total, y, fontB, 8.5, ink);
    y -= rowH;
  }

  const tt = inv.totals!;

  if (tt.shipEx > 0) {
    drawZebra(rowH);
    const shVat = inv.ship_vat_rate != null ? inv.ship_vat_rate : 0.21;
    page.drawText(T("Doprava"), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T("1"), cX.qty, y, font, 8.5, ink);
    rightText(money(tt.shipEx), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round(shVat * 100) + " %"), cX.vat, y, font, 8.5, grey);
    rightText(money(tt.shipEx), cX.ex, y, font, 8.5, ink);
    rightText(money(tt.shipVat), cX.dph, y, font, 8.5, grey);
    rightText(money(tt.shipEx + tt.shipVat), cX.total, y, fontB, 8.5, ink);
    y -= rowH;
  }

  y -= 2;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: contentR, y: y + 6 }, thickness: 0.6, color: ink });
  y -= 8;
  if (inv.discount_pct) {
    const discVat = (sumVat * inv.discount_pct) / 100;
    page.drawText(T("Sleva " + inv.discount_pct + " %"), { x: M, y, size: 8.5, font, color: grey });
    rightText("- " + money(tt.discountEx), cX.ex, y, font, 8.5, grey);
    rightText("- " + money(discVat), cX.dph, y, font, 8.5, grey);
    rightText("- " + money(tt.discountEx + discVat), cX.total, y, font, 8.5, grey);
    y -= 15;
  }

  page.drawText(T("Součet"), { x: M, y, size: 9, font: fontB, color: ink });
  rightText(money(tt.totalEx), cX.ex, y, fontB, 9, ink);
  rightText(money(tt.totalVat), cX.dph, y, fontB, 9, ink);
  rightText(money(tt.grand), cX.total, y, fontB, 9, ink);
  y -= 16;

  const barH = 28;
  page.drawRectangle({ x: M - 4, y: y - barH + 9, width: contentR - M + 8, height: barH, color: rgb(0.95, 0.96, 0.97) });
  page.drawText(T("Celkem k úhradě"), { x: M + 4, y: y - 5, size: 11, font: fontB, color: ink });
  rightText(money(tt.grand) + " " + (inv.currency || "CZK"), contentR - 2, y - 6, fontB, 13, ink);
  y -= barH + 10;

  const qrPng = await makePaymentQrPng(inv);
  if (qrPng) {
    try {
      const qrImg = await pdfDoc.embedPng(qrPng);
      y -= 14;
      const panelH = 104,
        pad = 14,
        qs = panelH - pad * 2;
      const panelTop = y,
        panelBottom = y - panelH;
      page.drawRectangle({ x: M, y: panelBottom, width: contentR - M, height: panelH, color: rgb(0.97, 0.975, 0.98) });
      page.drawRectangle({
        x: M,
        y: panelBottom,
        width: contentR - M,
        height: panelH,
        borderColor: rgb(0.88, 0.89, 0.91),
        borderWidth: 0.8,
      });
      const qx = M + pad,
        qy = panelBottom + pad;
      page.drawImage(qrImg, { x: qx, y: qy, width: qs, height: qs });
      const tx = qx + qs + 18;
      let ty2 = panelTop - pad - 6;
      page.drawText(T("Zaplaťte mobilem"), { x: tx, y: ty2, size: 11, font: fontB, color: ink });
      ty2 -= 16;
      page.drawText(T("Naskenujte QR kód v bankovní aplikaci."), { x: tx, y: ty2, size: 8.5, font, color: grey });
      ty2 -= 13;
      page.drawText(T("Částka, účet i variabilní symbol jsou předvyplněné."), { x: tx, y: ty2, size: 8.5, font, color: grey });
      ty2 -= 18;
      const accLbl = inv.foreign ? "IBAN" : "Účet";
      const accVal = inv.foreign ? (accountToIban(SUPPLIER.bank) || "").replace(/(.{4})/g, "$1 ").trim() : SUPPLIER.bank;
      page.drawText(T(`${accLbl}: ${accVal}`), { x: tx, y: ty2, size: 9, font: fontB, color: ink });
      ty2 -= 13;
      page.drawText(T(`VS: ${inv.number}   ·   ${money(tt.grand)} ${inv.currency || "CZK"}`), {
        x: tx,
        y: ty2,
        size: 9,
        font: fontB,
        color: ink,
      });
    } catch {
      // QR panel is a convenience, not a legal requirement — skip silently on failure.
    }
  }

  const fY = M + 14;
  page.drawLine({ start: { x: M, y: fY + 18 }, end: { x: contentR, y: fY + 18 }, thickness: 0.4, color: line });
  page.drawText(T("Děkujeme za Vaši objednávku."), { x: M, y: fY, size: 8.5, font, color: grey });
  rightText(T(SUPPLIER.name + "  ·  IČO " + SUPPLIER.ico + "  ·  DIČ " + SUPPLIER.dic), contentR, fY, font, 8, grey);

  return pdfDoc.save();
}
