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
  const ink = rgb(0.12, 0.14, 0.16),
    grey = rgb(0.42, 0.45, 0.48),
    light = rgb(0.58, 0.61, 0.64),
    line = rgb(0.88, 0.89, 0.91),
    soft = rgb(0.975, 0.976, 0.978);
  const cur = inv.currency || "CZK";
  const money = (n: number) => T(fmtMoney(n, cur as "CZK" | "EUR"));
  // V tabulce bez „Kč“ — jinak se částky v těsných sloupcích překrývají a vypadají zdvojeně.
  const moneyNum = (n: number) =>
    T(
      new Intl.NumberFormat("cs-CZ", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(Number.isFinite(n) ? n : 0)
    );
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

  // ---- Header (product invoice) — čistý boxový layout bez barevných akcentů. ----
  const boxBorder = rgb(0.86, 0.87, 0.89);
  const drawBox = (x: number, yTop: number, w: number, h: number, _fill = false) => {
    // Bez výplně — dřívější soft/žlutavé pruhy pryč, jen jemný rámeček.
    page.drawRectangle({ x, y: yTop - h, width: w, height: h, borderColor: boxBorder, borderWidth: 0.7 });
  };

  page.drawText(T(SUPPLIER.name), { x: M, y, size: 12, font: fontB, color: ink });
  let ly = y - 15;
  [SUPPLIER.street, SUPPLIER.city].forEach((l) => {
    page.drawText(T(l), { x: M, y: ly, size: 8.5, font, color: grey });
    ly -= 11;
  });
  ly -= 2;
  page.drawText(T("Zápis v obchodním rejstříku:"), { x: M, y: ly, size: 7, font, color: light });
  ly -= 9;
  page.drawText(T(SUPPLIER.registry), { x: M, y: ly, size: 7.5, font, color: grey });
  ly -= 10;

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

  y = Math.min(ly, ry) - 14;

  // Titulek: daňový doklad vlevo, FAKTURA vpravo.
  y -= 4;
  const titleW = fontB.widthOfTextAtSize("FAKTURA", 20);
  page.drawText(T("Daňový doklad"), { x: M, y: y + 4, size: 9, font, color: grey });
  page.drawText(T("FAKTURA"), { x: contentR - titleW, y, size: 20, font: fontB, color: ink });
  y -= 10;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.8, color: ink });
  y -= 16;

  // Box A (číslo faktury) + Box B (odběratel) vedle sebe.
  const boxTop1 = y;
  const boxH1 = 96;
  const boxW1 = 232;
  const boxW2 = contentR - M - boxW1 - 12;
  drawBox(M, boxTop1, boxW1, boxH1, true);
  let iy = boxTop1 - 18;
  page.drawText(T("Číslo faktury"), { x: M + 12, y: iy, size: 7.5, font: fontB, color: light });
  iy -= 15;
  page.drawText(T(inv.number), { x: M + 12, y: iy, size: 15, font: fontB, color: ink });
  iy -= 22;
  page.drawText(T("Objednávka číslo"), { x: M + 12, y: iy, size: 8, font, color: grey });
  rightText(T(inv.order_number || "—"), M + boxW1 - 12, iy, fontB, 9, ink);
  iy -= 15;
  page.drawText(T("Forma úhrady"), { x: M + 12, y: iy, size: 8, font, color: grey });
  rightText(T("Bankovním převodem"), M + boxW1 - 12, iy, font, 8.5, ink);

  const boxX2 = M + boxW1 + 12;
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

  y = boxTop1 - boxH1 - 12;

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

  y = boxTop2 - boxH2 - 20;

  // Širší rozestupy sloupců + částky bez „Kč“, ať se nepřekrývají.
  const cX = { qty: 248, unit: 302, vat: 340, ex: 402, dph: 462, total: contentR };
  const head = (txt: string, x: number, rightAlign = true) => {
    if (rightAlign) rightText(T(txt), x, y, fontB, 7, grey);
    else page.drawText(T(txt), { x, y, size: 7, font: fontB, color: grey });
  };
  head("Položka", M, false);
  head("Ks", cX.qty);
  head("Cena/ks", cX.unit);
  head("DPH %", cX.vat);
  head("Bez DPH", cX.ex);
  head("DPH", cX.dph);
  head("S DPH", cX.total);
  y -= 8;
  page.drawLine({ start: { x: M, y }, end: { x: contentR, y }, thickness: 0.6, color: ink });
  y -= 14;

  const rowH = 20,
    descX = M;
  let discountableVat = 0;
  let zebra = false;
  // h > rowH = položka má pod názvem ještě řádky s konfigurací, pruh musí
  // sahat dolů až pod ně (y je baseline prvního řádku, další jdou níž).
  const drawZebra = (h: number) => {
    if (zebra)
      page.drawRectangle({
        x: M - 2,
        y: y - 9 - (h - rowH),
        width: contentR - M + 4,
        height: h - 4,
        color: soft,
      });
    zebra = !zebra;
  };

  // Ořez na šířku sloupce Položka — pdf-lib text nezalamuje ani nekontroluje
  // kolize, takže si delší popis zkrátíme sami.
  const fitDesc = (txt: string, size: number, f: typeof font) => {
    let out = txt;
    while (f.widthOfTextAtSize(T(out), size) > cX.qty - descX - 8 && out.length > 8) out = out.slice(0, -2);
    return T(out + (out !== txt ? "…" : ""));
  };

  // Rozpis konfigurace se zalamuje přes celou šířku stránky, ne do úzkého
  // sloupce Položka — jinak by každá stěna stanu zabrala vlastní řádek a
  // rozpis by vytlačil QR panel z jediné (nestránkované) stránky.
  const SPEC_SIZE = 7.5;
  const SPEC_LINE_H = 9;
  const SPEC_WIDTH = contentR - descX - 6;
  const wrapSpecs = (parts: string[]) => {
    const lines: string[] = [];
    let current = "";
    for (const part of parts) {
      const candidate = current ? `${current} · ${part}` : part;
      if (current && font.widthOfTextAtSize(T(candidate), SPEC_SIZE) > SPEC_WIDTH) {
        lines.push(current);
        current = part;
      } else {
        current = candidate;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  for (const it of inv.items) {
    const lineEx = it.unitPrice * it.qty;
    const lineVat = lineEx * (it.vatRate || 0);
    const lineGross = lineEx + lineVat;
    if (!it.noDiscount) discountableVat += lineVat;
    // Konfigurace (stěny stanu, barva rámu…) jde pod název položky po
    // řádcích — jinak by se celý popis stanu do jednoho řádku nevešel.
    const specs = wrapSpecs(it.specs || []);
    const itemH = rowH + specs.length * SPEC_LINE_H;
    drawZebra(itemH);

    page.drawText(fitDesc(it.desc, 8.5, font), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T(String(it.qty)), cX.qty, y, font, 8.5, ink);
    rightText(moneyNum(it.unitPrice), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round((it.vatRate || 0) * 100) + " %"), cX.vat, y, font, 8.5, grey);
    rightText(moneyNum(lineEx), cX.ex, y, font, 8.5, ink);
    rightText(moneyNum(lineVat), cX.dph, y, font, 8.5, grey);
    // Regular (ne bold) — bold Noto u malých částek vypadá jako zdvojený tisk.
    rightText(moneyNum(lineGross), cX.total, y, font, 8.5, ink);
    let specY = y - SPEC_LINE_H;
    for (const spec of specs) {
      page.drawText(T(spec), { x: descX + 6, y: specY, size: SPEC_SIZE, font, color: grey });
      specY -= SPEC_LINE_H;
    }
    y -= itemH;
  }

  const tt = inv.totals!;

  if (tt.shipEx > 0) {
    drawZebra(rowH);
    const shVat = inv.ship_vat_rate != null ? inv.ship_vat_rate : 0.21;
    page.drawText(T("Doprava"), { x: descX, y, size: 8.5, font, color: ink });
    rightText(T("1"), cX.qty, y, font, 8.5, ink);
    rightText(moneyNum(tt.shipEx), cX.unit, y, font, 8.5, ink);
    rightText(T(Math.round(shVat * 100) + " %"), cX.vat, y, font, 8.5, grey);
    rightText(moneyNum(tt.shipEx), cX.ex, y, font, 8.5, ink);
    rightText(moneyNum(tt.shipVat), cX.dph, y, font, 8.5, grey);
    rightText(moneyNum(tt.shipEx + tt.shipVat), cX.total, y, font, 8.5, ink);
    y -= rowH;
  }

  y -= 2;
  page.drawLine({ start: { x: M, y: y + 6 }, end: { x: contentR, y: y + 6 }, thickness: 0.6, color: line });
  y -= 8;
  if (inv.discount_pct) {
    const discVat = (discountableVat * inv.discount_pct) / 100;
    page.drawText(T("Sleva " + inv.discount_pct + " %"), { x: M, y, size: 8.5, font, color: grey });
    rightText("- " + moneyNum(tt.discountEx), cX.ex, y, font, 8.5, grey);
    rightText("- " + moneyNum(discVat), cX.dph, y, font, 8.5, grey);
    rightText("- " + moneyNum(tt.discountEx + discVat), cX.total, y, font, 8.5, grey);
    y -= 15;
  }

  page.drawText(T("Součet"), { x: M, y, size: 9, font: fontB, color: ink });
  rightText(moneyNum(tt.totalEx), cX.ex, y, font, 9, ink);
  rightText(moneyNum(tt.totalVat), cX.dph, y, font, 9, ink);
  rightText(moneyNum(tt.grand), cX.total, y, font, 9, ink);
  y -= 16;

  const barH = 28;
  page.drawLine({ start: { x: M - 2, y: y + 9 }, end: { x: contentR + 2, y: y + 9 }, thickness: 0.7, color: ink });
  page.drawText(T("Celkem k úhradě"), { x: M + 4, y: y - 5, size: 11, font: fontB, color: ink });
  // Velká částka regular — bold u Noto + pdf-lib vypadá rozmazaně / „zdvojeně“.
  rightText(money(tt.grand), contentR - 2, y - 6, font, 14, ink);
  y -= barH + 12;

  // Patička sedí na pevné výšce (fY níž) a dokument se nestránkuje — u dlouhého
  // rozpisu (hodně položek, nebo položka s konfigurací na víc řádků) se QR panel
  // do zbytku stránky nemusí vejít. Zmenší se tedy podle volného místa (texty
  // uvnitř potřebují ~80 b.) a teprve pod tuhle mez se vynechá — přetisknout se
  // s patičkou nesmí, ale QR platba je pro zákazníka moc užitečná na to, aby se
  // zahazovala při prvním těsném rozpisu.
  const footerTop = M + 14 + 18 + 8;
  const QR_PANEL_MAX = 104;
  const QR_PANEL_MIN = 88; // pod tuhle výšku by se texty v panelu dotkly okraje
  const panelH = Math.min(QR_PANEL_MAX, y - 14 - footerTop);
  const qrPng = panelH >= QR_PANEL_MIN ? await makePaymentQrPng(inv) : null;
  if (qrPng) {
    try {
      const qrImg = await pdfDoc.embedPng(qrPng);
      y -= 14;
      const pad = 14,
        qs = panelH - pad * 2;
      const panelTop = y,
        panelBottom = y - panelH;
      page.drawRectangle({ x: M, y: panelBottom, width: contentR - M, height: panelH, color: soft });
      page.drawRectangle({
        x: M,
        y: panelBottom,
        width: contentR - M,
        height: panelH,
        borderColor: boxBorder,
        borderWidth: 0.7,
      });
      const qx = M + pad,
        qy = panelBottom + pad;
      page.drawImage(qrImg, { x: qx, y: qy, width: qs, height: qs });
      const tx = qx + qs + 18;
      let ty2 = panelTop - pad - 6;
      page.drawText(T("Zaplaťte mobilem"), { x: tx, y: ty2, size: 11, font: fontB, color: ink });
      ty2 -= 15;
      page.drawText(T("Naskenujte QR kód v bankovní aplikaci."), { x: tx, y: ty2, size: 8.5, font, color: grey });
      ty2 -= 12;
      page.drawText(T("Částka, účet i variabilní symbol jsou předvyplněné."), { x: tx, y: ty2, size: 8.5, font, color: grey });
      ty2 -= 18;
      const accLbl = inv.is_foreign ? "IBAN" : "Účet";
      const accVal = inv.is_foreign ? (accountToIban(SUPPLIER.bank) || "").replace(/(.{4})/g, "$1 ").trim() : SUPPLIER.bank;
      page.drawText(T(`${accLbl}: ${accVal}`), { x: tx, y: ty2, size: 9, font: fontB, color: ink });
      ty2 -= 13;
      // money() už obsahuje „Kč“ / „€“ — nepřidávat ještě CZK/EUR (vypadá to zdvojeně).
      page.drawText(T(`VS: ${inv.number}   ·   ${money(tt.grand)}`), {
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
