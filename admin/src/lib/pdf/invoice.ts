// Server-side port of generateInvoicePdf() from the old app.js (lines ~4261-4575).
// Difference from the original: item design thumbnails are not embedded (that required
// browser canvas APIs); everything else (layout, Czech font, QR payment panel, payout
// invoice variant) is ported 1:1 so numbers/wording match exactly.
import { PDFDocument, rgb, StandardFonts, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";
import { fmtMoney, SUPPLIER } from "@/lib/domain";
import { accountToIban, buildSpdString } from "./iban";
import { loadCzechFontBytes } from "./font";
import type { Invoice } from "@/lib/types";

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

  // ---- Header (product invoice) — boxový layout podle vzoru účetní (papírová
  // faktura z účetního softwaru), bez reverse charge a bez účetního rozúčtování
  // dole (to je specifické pro jejich SW, ne pro doklad samotný). ----
  const boxBorder = rgb(0.74, 0.76, 0.79);
  const boxFill = rgb(0.975, 0.978, 0.983);
  const drawBox = (x: number, yTop: number, w: number, h: number, fill = false) => {
    if (fill) page.drawRectangle({ x, y: yTop - h, width: w, height: h, color: boxFill });
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: boxBorder, borderWidth: 0.8 });
  };

  page.drawText(T(SUPPLIER.name), { x: M, y, size: 13, font: fontB, color: ink });
  let ly = y - 16;
  [SUPPLIER.street, SUPPLIER.city].forEach((l) => {
    page.drawText(T(l), { x: M, y: ly, size: 8.5, font, color: grey });
    ly -= 11;
  });
  ly -= 3;
  page.drawText(T("Zápis v obchodním rejstříku:"), { x: M, y: ly, size: 7, font, color: light });
  ly -= 9;
  page.drawText(T(SUPPLIER.registry), { x: M, y: ly, size: 8, font, color: grey });
  ly -= 11;

  let ry = y;
  const iban = accountToIban(SUPPLIER.bank);
  const bankRows: [string, string][] = [
    ["DIČ", SUPPLIER.dic],
    ["IČ", SUPPLIER.ico],
    ["Účet", SUPPLIER.bank],
  ];
  if (iban) bankRows.push(["IBAN", iban.replace(/(.{4})/g, "$1 ").trim()]);
  if (SUPPLIER.bic) bankRows.push(["BIC", SUPPLIER.bic]);
  bankRows.forEach(([label, val]) => {
    page.drawText(T(label), { x: M + 330, y: ry, size: 8, font, color: grey });
    rightText(T(val), contentR, ry, fontB, 8.5, ink);
    ry -= 12;
  });

  y = Math.min(ly, ry) - 16;

  // "Daňový doklad — FAKTURA" titulek s vláskovými linkami po stranách.
  const titleW = fontB.widthOfTextAtSize("FAKTURA", 22);
  page.drawLine({ start: { x: M, y: y + 5 }, end: { x: M + 84, y: y + 5 }, thickness: 1.2, color: ink });
  page.drawText(T("Daňový doklad"), { x: M + 92, y, size: 9, font: fontB, color: grey });
  page.drawLine({
    start: { x: M + 92 + font.widthOfTextAtSize("Daňový doklad", 9) + 14, y: y + 5 },
    end: { x: contentR - titleW - 16, y: y + 5 },
    thickness: 1.2,
    color: ink,
  });
  page.drawText(T("FAKTURA"), { x: contentR - titleW, y: y - 3, size: 22, font: fontB, color: ink });
  y -= 30;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.8, color: ink });
  y -= 16;

  // Box A (číslo faktury) + Box B (odběratel) vedle sebe.
  const boxTop1 = y;
  const boxH1 = 96;
  const boxW1 = 232;
  const boxW2 = contentR - M - boxW1 - 14;
  drawBox(M, boxTop1, boxW1, boxH1, true);
  let iy = boxTop1 - 18;
  page.drawText(T("Číslo faktury"), { x: M + 12, y: iy, size: 7.5, font: fontB, color: light });
  iy -= 15;
  page.drawText(T(inv.number), { x: M + 12, y: iy, size: 14, font: fontB, color: ink });
  iy -= 22;
  page.drawText(T("Objednávka číslo"), { x: M + 12, y: iy, size: 8, font, color: grey });
  rightText(T(inv.order_number || "—"), M + boxW1 - 12, iy, fontB, 9, ink);
  iy -= 15;
  page.drawText(T("Forma úhrady"), { x: M + 12, y: iy, size: 8, font, color: grey });
  rightText(T("Převodním příkazem"), M + boxW1 - 12, iy, font, 8.5, ink);

  const boxX2 = M + boxW1 + 14;
  drawBox(boxX2, boxTop1, boxW2, boxH1);
  const c = inv.customer!;
  page.drawText(T("Odběratel"), { x: boxX2 + 12, y: boxTop1 - 16, size: 7.5, font: fontB, color: light });
  const billLines = [
    c.company || c.name || "",
    c.company && c.name ? c.name : "",
    c.street,
    [c.psc, c.city].filter(Boolean).join(" "),
    [c.ico ? "IČ: " + c.ico : "", c.dic ? "DIČ: " + c.dic : ""].filter(Boolean).join("   "),
  ].filter((v): v is string => Boolean(v));
  billLines.forEach((l, i) =>
    page.drawText(T(l), {
      x: boxX2 + 12,
      y: boxTop1 - 32 - i * 12,
      size: i === 0 ? 9.5 : 8.5,
      font: i === 0 ? fontB : font,
      color: i === 0 ? ink : grey,
    })
  );

  y = boxTop1 - boxH1 - 14;

  // Box C (doručovací adresa) + Box D (data) vedle sebe.
  const boxTop2 = y;
  const boxH2 = 82;
  drawBox(M, boxTop2, boxW1, boxH2);
  page.drawText(T("Doručovací adresa"), { x: M + 12, y: boxTop2 - 16, size: 7.5, font: fontB, color: light });
  const ship = (inv.shipping_customer || {}) as Record<string, string>;
  const shipLines = [
    ship.ship_company || ship.ship_name || c.company || c.name || "",
    ship.ship_street || c.street,
    [ship.ship_psc || c.psc, ship.ship_city || c.city].filter(Boolean).join(" "),
  ].filter((v): v is string => Boolean(v));
  shipLines.forEach((l, i) =>
    page.drawText(T(l), {
      x: M + 12,
      y: boxTop2 - 32 - i * 12,
      size: i === 0 ? 9 : 8.5,
      font: i === 0 ? fontB : font,
      color: i === 0 ? ink : grey,
    })
  );

  drawBox(boxX2, boxTop2, boxW2, boxH2, true);
  const dateRows: [string, string][] = [
    ["Datum vystavení", fmtD(inv.issued)],
    ["Datum zdan. plnění (UZP)", fmtD(inv.tax_date || inv.issued)],
    ["Datum splatnosti", fmtD(inv.due)],
  ];
  dateRows.forEach((m, i) => {
    const ry2 = boxTop2 - 18 - i * 16;
    page.drawText(T(m[0]), { x: boxX2 + 12, y: ry2, size: 8.5, font, color: grey });
    rightText(T(m[1]), boxX2 + boxW2 - 12, ry2, fontB, 9, ink);
  });

  y = boxTop2 - boxH2 - 22;

  // Sloupce DPH/Cena bez DPH/Cena s DPH byly moc namačkané u sebe — u
  // vyšších částek se čísla přes sebe přetírala (pdf-lib nezalamuje ani
  // nekontroluje kolize, jen kreslí text na zadanou souřadnici).
  const cX = { qty: 255, unit: 315, vat: 350, ex: 415, dph: 475, total: contentR };
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

  // Rozpis podle sazby DPH (základ a daň za každou sazbu) — jako v účetním
  // softwaru. Sleva se týká jen produktů, ne dopravy — stejně jako
  // v computeOrderTotals/buildInvoiceRow.
  type VatGroup = { prodEx: number; prodVat: number; shipEx: number; shipVat: number };
  const vatGroups = new Map<number, VatGroup>();
  const group = (rate: number): VatGroup => {
    let g = vatGroups.get(rate);
    if (!g) {
      g = { prodEx: 0, prodVat: 0, shipEx: 0, shipVat: 0 };
      vatGroups.set(rate, g);
    }
    return g;
  };
  for (const it of inv.items) {
    const lineEx = it.unitPrice * it.qty;
    const g = group(it.vatRate || 0);
    g.prodEx += lineEx;
    g.prodVat += lineEx * (it.vatRate || 0);
  }
  if (tt.shipEx > 0) {
    const shVat = inv.ship_vat_rate != null ? inv.ship_vat_rate : 0.21;
    const g = group(shVat);
    g.shipEx += tt.shipEx;
    g.shipVat += tt.shipEx * shVat;
  }
  const discFactor = inv.discount_pct ? 1 - inv.discount_pct / 100 : 1;
  const vatRates = [...vatGroups.keys()].sort((a, b) => a - b);
  if (vatRates.length > 0) {
    const vatColW = (contentR - M - 130) / vatRates.length;
    const vatBoxH = 54;
    drawBox(M, y, contentR - M, vatBoxH, true);
    page.drawText(T("Sazba DPH"), { x: M + 8, y: y - 14, size: 7.5, font: fontB, color: light });
    vatRates.forEach((rate, i) => {
      const cx = M + 130 + i * vatColW + vatColW - 8;
      rightText(T(Math.round(rate * 100) + " %"), cx, y - 14, fontB, 8, ink);
    });
    const vatRowValues = vatRates.map((rate) => {
      const g = vatGroups.get(rate)!;
      return { ex: g.prodEx * discFactor + g.shipEx, vat: g.prodVat * discFactor + g.shipVat };
    });
    const drawVatRow = (label: string, ry3: number, pick: (v: { ex: number; vat: number }) => number, bold = false) => {
      page.drawText(T(label), { x: M + 8, y: ry3, size: 8, font, color: grey });
      let sum = 0;
      vatRowValues.forEach((v, i) => {
        const val = pick(v);
        sum += val;
        const cx = M + 130 + i * vatColW + vatColW - 8;
        rightText(money(val), cx, ry3, bold ? fontB : font, 8.5, ink);
      });
      rightText(money(sum), contentR - 8, ry3, fontB, 8.5, ink);
    };
    drawVatRow("Základ daně", y - 30, (v) => v.ex);
    drawVatRow("Daň", y - 44, (v) => v.vat, true);
    y -= vatBoxH + 12;
  }

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
      const accLbl = inv.is_foreign ? "IBAN" : "Účet";
      const accVal = inv.is_foreign ? (accountToIban(SUPPLIER.bank) || "").replace(/(.{4})/g, "$1 ").trim() : SUPPLIER.bank;
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
