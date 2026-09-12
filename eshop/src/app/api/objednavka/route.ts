import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { createServiceClient } from "@/lib/supabase";
import { fmtMoney } from "@/lib/money";
import { getCheckoutSettings } from "@/lib/checkoutSettings";
import type { CartLine, CustomerAddress, Product, ProductCategory } from "@/lib/types";
import { billingFieldErrors, firstFieldError, shippingFieldErrors } from "@/lib/validation";
import {
  createSessionCookie,
  DEFAULT_DISCOUNT_PCT,
  generateDiscountCode,
  getSessionCustomerId,
  hashPassword,
  isStrongEnoughPassword,
  MAX_SHIPPING_ADDRESSES,
  setPurchaseAccessCookie,
} from "@/lib/customer-auth";
import { discountCodeEmailHtml, sendCustomerMail } from "@/lib/customer-mail";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/security";
import { MAX_ARTWORK_BYTES, verifyCartLines } from "@/lib/verify-cart-prices";
import { decodeSafeImageDataUrl } from "@/lib/safe-image";

// Stejná sazba jako v checkoutu (src/app/objednavka/page.tsx), dokud admin
// nezavede vlastní sazby pro dopravu/platbu.
const STANDARD_VAT_RATE = 0.21;

type MailSettings = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName?: string;
  from?: string;
};

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function orderConfirmationEmailHtml(
  orderLabel: string,
  billing: CustomerAddress,
  lines: CartLine[],
  shippingLabel: string | null,
  shippingPriceEx: number,
  paymentLabel: string | null,
  paymentPriceEx: number,
  vatRate: number
): string {
  const rows = lines
    .map(
      (l) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(l.name)}${
          l.note ? `<br><span style="color:#777;font-size:12px;">${escapeHtml(l.note)}</span>` : ""
        }</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">${l.qty}×</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${fmtMoney(l.unitPrice * l.qty)}</td>
        </tr>`
    )
    .join("");
  const productSubtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const productVat = lines.reduce((s, l) => s + l.unitPrice * l.qty * l.vatRate, 0);
  const subtotalEx = productSubtotalEx + shippingPriceEx + paymentPriceEx;
  const vat = productVat + (shippingPriceEx + paymentPriceEx) * vatRate;
  const extraRows = [
    shippingLabel ? { label: `Doprava — ${shippingLabel}`, price: shippingPriceEx } : null,
    paymentLabel && paymentPriceEx > 0 ? { label: `Platba — ${paymentLabel}`, price: paymentPriceEx } : null,
  ].filter((r): r is { label: string; price: number } => r != null);
  const extraRowsHtml = extraRows
    .map(
      (r) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;">${escapeHtml(r.label)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center;">—</td>
          <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:right;">${r.price > 0 ? fmtMoney(r.price) : "Zdarma"}</td>
        </tr>`
    )
    .join("");
  const name = billing.name || billing.company || "";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 560px; margin: 0 auto;">
      <p>Dobrý den${name ? ` ${escapeHtml(name)}` : ""},</p>
      <p>děkujeme, přijali jsme Vaši objednávku <strong>${escapeHtml(orderLabel)}</strong> na provlajky.cz. Ozveme se s pokyny k platbě, případně upřesněním detailů.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px;">
        <thead>
          <tr>
            <th style="text-align:left;padding:6px 10px;border-bottom:2px solid #08080a;">Položka</th>
            <th style="text-align:center;padding:6px 10px;border-bottom:2px solid #08080a;">Ks</th>
            <th style="text-align:right;padding:6px 10px;border-bottom:2px solid #08080a;">Cena</th>
          </tr>
        </thead>
        <tbody>${rows}${extraRowsHtml}</tbody>
      </table>
      <p style="margin-top:14px;">
        Mezisoučet bez DPH: <strong>${fmtMoney(subtotalEx)}</strong><br>
        DPH: <strong>${fmtMoney(vat)}</strong><br>
        Celkem: <strong>${fmtMoney(subtotalEx + vat)}</strong>
      </p>
      <p>Máte dotaz? Ozvěte se na <a href="mailto:info@provlajky.cz">info@provlajky.cz</a> nebo <a href="tel:+420605981155">+420 605 981 155</a>.</p>
      <p>Tým PROVLAJKY.CZ</p>
    </div>
  `;
}

type Body = {
  billing: CustomerAddress;
  shipping: CustomerAddress;
  note?: string;
  lines: CartLine[];
  discountCode?: string;
  shippingMethodId?: string;
  paymentMethodId?: string;
  /** Volitelně vytvořit účet při odeslání (host checkout). */
  createAccount?: boolean;
  accountPassword?: string;
  /** Uložit dodací adresu k účtu (když se liší od fakturační). */
  saveShippingAddress?: boolean;
  shippingAddressId?: string | null;
  shippingAddressLabel?: string | null;
};

// Bucket pro nahranou grafiku podle kategorie produktu (buckety založené
// ručně v Supabase Storage — public, bez size limitu).
const CATEGORY_BUCKET: Partial<Record<ProductCategory, string>> = {
  "plazove-vlajky": "grafika_plazove_vlajky",
  "vlajky-na-zakazku": "grafika_vlajky",
  "pvc-bannery": "grafika_bannery",
};

export async function POST(req: NextRequest) {
  // Rate limit: max 8 objednávek za 60s z jedné IP.
  const ip = clientIp(req);
  const rl = rateLimit(`objednavka:${ip}`, { limit: 8, windowMs: 60_000 });
  if (!rl.ok) return rateLimitResponse(rl.retryAfterSec);

  let body: Body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Neplatná data." }, { status: 400 });
  }

  const {
    billing,
    shipping,
    lines: rawLines,
    note,
    discountCode,
    shippingMethodId,
    paymentMethodId,
    createAccount,
    accountPassword,
    saveShippingAddress,
    shippingAddressId,
    shippingAddressLabel,
  } = body;

  if (!billing) {
    return NextResponse.json({ error: "Vyplňte prosím jméno/firmu a e-mail." }, { status: 400 });
  }
  const billingError = firstFieldError(billingFieldErrors(billing));
  if (billingError) {
    return NextResponse.json({ error: billingError }, { status: 400 });
  }
  const shippingError = firstFieldError(shippingFieldErrors(shipping ?? {}));
  if (shippingError) {
    return NextResponse.json({ error: shippingError }, { status: 400 });
  }
  if (!Array.isArray(rawLines) || rawLines.length === 0) {
    return NextResponse.json({ error: "Košík je prázdný." }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Ověření cen: načteme produkty a zkontrolujeme, že zákazník nepodstrčil
  // jiné ceny než jsou v katalogu.
  const rawProductIds = [...new Set(rawLines.map((l) => l.productId).filter(Boolean))];
  const productsById = new Map<string, Product>();
  if (rawProductIds.length) {
    const { data: products } = await supabase
      .from("products")
      .select("id, slug, category, name, kind, price, price_by_size, vat_rate, active, config")
      .in("id", rawProductIds);
    for (const p of products || []) productsById.set(p.id, p as Product);
  }
  const verified = verifyCartLines(rawLines, productsById);
  if (!verified.ok) {
    return NextResponse.json({ error: verified.error }, { status: 400 });
  }
  const lines = verified.lines;

  // Slevový kód se ověřuje a spotřebovává výhradně tady, server-side — nikdy
  // z prohlížeče. Neplatný/použitý kód objednávku odmítne, ať zákazník ví,
  // že sleva neprošla, místo aby se potichu ztratila.
  let discountCustomer: { id: string; discount_pct: number } | null = null;
  const normalizedCode = discountCode?.trim().toUpperCase();
  if (normalizedCode) {
    const { data: customer, error: lookupError } = await supabase
      .from("customers")
      .select("id, discount_pct, used_at")
      .eq("discount_code", normalizedCode)
      .maybeSingle();
    if (lookupError) {
      console.error("objednavka: discount code lookup failed", lookupError);
      return NextResponse.json({ error: "Nepodařilo se ověřit slevový kód, zkuste to prosím znovu." }, { status: 500 });
    }
    if (!customer || customer.used_at) {
      return NextResponse.json({ error: "Slevový kód je neplatný nebo už byl použitý." }, { status: 400 });
    }
    discountCustomer = { id: customer.id, discount_pct: customer.discount_pct };
  }

  // Cena dopravy/platby se počítá tady, server-side, z adminem nastavených
  // částek — klientem poslané ceny se nikdy nepoužijí (viz Settings →
  // Doprava a platby).
  const checkoutSettings = await getCheckoutSettings();
  const subtotalEx = lines.reduce((s, l) => s + l.unitPrice * l.qty, 0);
  const selectedShipping = checkoutSettings.shippingMethods.find((m) => m.id === shippingMethodId) ?? null;
  const shippingFree =
    checkoutSettings.shippingFreeOverAmount > 0 && subtotalEx >= checkoutSettings.shippingFreeOverAmount;
  const shippingPriceEx = shippingFree ? 0 : selectedShipping?.price ?? 0;
  const selectedPayment = checkoutSettings.paymentMethods.find((m) => m.id === paymentMethodId) ?? null;
  const paymentPriceEx = selectedPayment?.price ?? 0;

  const methodNotes = [
    selectedShipping ? `Doprava: ${selectedShipping.label}${shippingFree ? " (zdarma)" : ""}` : null,
    selectedPayment && paymentPriceEx > 0 ? `Platba: ${selectedPayment.label} (+${fmtMoney(paymentPriceEx)})` : selectedPayment ? `Platba: ${selectedPayment.label}` : null,
  ].filter(Boolean);
  const titleSuffix = [...methodNotes, note].filter(Boolean).join(" — ");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .insert({
      status: "new",
      currency: "CZK",
      customer: { billing, shipping: shipping || billing },
      title: titleSuffix ? `Objednávka z eshopu — ${titleSuffix}`.slice(0, 200) : "Objednávka z eshopu",
      discount_pct: discountCustomer?.discount_pct ?? 0,
      shipping: shippingPriceEx + paymentPriceEx,
      ship_vat_rate: STANDARD_VAT_RATE,
    })
    .select("id, order_number")
    .single();

  if (orderError || !order) {
    if (orderError) console.error("objednavka: order insert failed", orderError);
    return NextResponse.json({ error: "Nepodařilo se založit objednávku, zkuste to prosím znovu." }, { status: 500 });
  }

  // Atomické nárokování slevového kódu — podmínka used_at IS NULL zabrání
  // dvojímu čerpání i v souběžných požadavcích.
  if (discountCustomer) {
    const { data: claimed } = await supabase
      .from("customers")
      .update({ used_at: new Date().toISOString(), used_order_id: order.id })
      .eq("id", discountCustomer.id)
      .is("used_at", null)
      .select("id")
      .maybeSingle();
    if (!claimed) {
      // Kód byl mezitím použit jiným požadavkem — sleva se nastaví na 0.
      await supabase.from("orders").update({ discount_pct: 0 }).eq("id", order.id);
    }
  }

  // Nastavit přístupový cookie pro zákazníka k této objednávce.
  await setPurchaseAccessCookie(order.id);

  // Účet: uložit billing / dodací adresu; případně založit účet z checkoutu.
  try {
    let customerId = await getSessionCustomerId();
    const email = (billing.email || "").trim().toLowerCase();

    if (!customerId && createAccount && email) {
      if (!accountPassword || !isStrongEnoughPassword(accountPassword)) {
        // Objednávka už je založená — účet jen přeskočíme, nevracíme 400.
        console.warn("objednavka: createAccount skipped — weak/missing password");
      } else {
        const passwordHash = await hashPassword(accountPassword);
        const { data: existing } = await supabase
          .from("customers")
          .select("id, password_hash, discount_code")
          .eq("email", email)
          .maybeSingle();

        if (existing?.password_hash) {
          // Účet už existuje — nepřepisujeme heslo; zákazník se může přihlásit.
        } else if (existing) {
          await supabase
            .from("customers")
            .update({
              password_hash: passwordHash,
              password_updated_at: new Date().toISOString(),
              name: billing.name || null,
              phone: billing.phone || null,
              billing,
            })
            .eq("id", existing.id);
          customerId = existing.id;
          await createSessionCookie(existing.id);
        } else {
          let code = generateDiscountCode();
          let insertedId: string | null = null;
          for (let attempt = 0; attempt < 5 && !insertedId; attempt++) {
            const { data, error } = await supabase
              .from("customers")
              .insert({
                email,
                name: billing.name || null,
                phone: billing.phone || null,
                discount_code: code,
                discount_pct: DEFAULT_DISCOUNT_PCT,
                password_hash: passwordHash,
                password_updated_at: new Date().toISOString(),
                billing,
                session_version: 1,
              })
              .select("id")
              .single();
            if (!error && data) {
              insertedId = data.id;
            } else if (error?.code === "23505") {
              code = generateDiscountCode();
            } else {
              console.error("objednavka: createAccount insert failed", error);
              break;
            }
          }
          if (insertedId) {
            customerId = insertedId;
            await createSessionCookie(customerId);
            await sendCustomerMail({
              to: email,
              subject: "Váš slevový kód — provlajky.cz",
              html: discountCodeEmailHtml(billing.name, code, DEFAULT_DISCOUNT_PCT),
            });
          }
        }
      }
    }

    if (customerId) {
      await supabase
        .from("customers")
        .update({
          billing,
          name: billing.name || null,
          phone: billing.phone || null,
        })
        .eq("id", customerId);

      const ship = shipping || billing;
      const billingSameAsShip =
        (billing.street || "") === (ship.street || "") &&
        (billing.psc || "") === (ship.psc || "") &&
        (billing.city || "") === (ship.city || "") &&
        (billing.name || "") === (ship.name || "");

      if (saveShippingAddress && !billingSameAsShip && ship.street && ship.psc && ship.city) {
        if (shippingAddressId) {
          await supabase
            .from("customer_shipping_addresses")
            .update({
              label: shippingAddressLabel || null,
              company: ship.company || null,
              name: ship.name || null,
              street: ship.street,
              psc: ship.psc,
              city: ship.city,
            })
            .eq("id", shippingAddressId)
            .eq("customer_id", customerId);
        } else {
          const { count } = await supabase
            .from("customer_shipping_addresses")
            .select("id", { count: "exact", head: true })
            .eq("customer_id", customerId);
          if ((count ?? 0) < MAX_SHIPPING_ADDRESSES) {
            await supabase.from("customer_shipping_addresses").insert({
              customer_id: customerId,
              label: shippingAddressLabel || null,
              company: ship.company || null,
              name: ship.name || null,
              street: ship.street,
              psc: ship.psc,
              city: ship.city,
            });
          }
        }
      }
    }
  } catch (e) {
    console.error("objednavka: customer profile sync failed", e);
  }

  // Nahraná grafika (logo u vlajek, artwork u banneru/vlajky na zakázku) se
  // navíc uloží do Supabase Storage pod číslem objednávky — base64 v design
  // JSONu se nemaže (pořád ho čte vizualizace/editor v adminu), tohle je jen
  // umístění originálu k výrobě (viz Design.artworkPath).
  const productIds = [...new Set(lines.map((l) => l.productId).filter(Boolean))];
  const categoryById = new Map<string, ProductCategory>();
  const partnerIdsByProduct = new Map<string, string[]>();
  if (productIds.length) {
    // categoryById naplníme z již načtených productů (productsById).
    for (const [id, p] of productsById) categoryById.set(id, p.category as ProductCategory);
    // products.partner_ids je z novější migrace (2026-08-order-item-product-link.sql)
    // — samostatný dotaz, ať nezhroutí i tu předchozí, dokud migrace neproběhla.
    try {
      const { data: withPartners, error } = await supabase.from("products").select("id, partner_ids").in("id", productIds);
      if (error) throw error;
      for (const p of withPartners || []) partnerIdsByProduct.set(p.id, (p.partner_ids as string[]) || []);
    } catch {
      // sloupec ještě neexistuje — položky se prostě založí bez výchozích partnerů
    }
  }

  const itemsPayload = await Promise.all(
    lines.map(async (l, i) => {
      let design = l.design ?? null;
      const bucket = CATEGORY_BUCKET[categoryById.get(l.productId) as ProductCategory];
      const graphicSrc = design?.logo?.src || design?.thumb || null;
      if (bucket && graphicSrc) {
        const decoded = decodeSafeImageDataUrl(graphicSrc, MAX_ARTWORK_BYTES);
        if (decoded) {
          // order_number přiděluje DB trigger (2026-08-order-numbering.sql) —
          // dokud migrace neběžela, order.order_number je null; radši dočasně
          // roztřídit pod ID objednávky, než abychom všechno házeli do jedné
          // společné složky "null".
          const folder = order.order_number || order.id;
          const storagePath = `${folder}/${i + 1}.${decoded.ext}`;
          const { error: uploadError } = await supabase.storage
            .from(bucket)
            .upload(storagePath, decoded.buffer, { contentType: decoded.contentType, upsert: true });
          if (uploadError) {
            console.error("objednavka: storage upload failed", uploadError);
          } else {
            // Ukládá se jen umístění, ne odkaz. Buckety s grafikou zákazníků
            // jsou privátní — veřejná URL by šla uhodnout z čísla objednávky,
            // které jde po sobě, takže by si kdokoliv stáhl cizí loga.
            design = { ...design, artworkPath: `${bucket}/${storagePath}` };
          }
        }
      }
      return {
        order_id: order.id,
        type: l.type === "product" ? "flag" : l.type,
        shape: l.shape,
        size: l.size,
        width_cm: l.widthCm ?? null,
        height_cm: l.heightCm ?? null,
        qty: l.qty,
        unit_price: l.unitPrice,
        vat_rate: l.vatRate,
        wc_line_name: [l.name, l.note].filter(Boolean).join(" — "),
        design,
        product_id: l.productId || null,
        material: l.material ?? null,
        variant_id: l.variantId ?? null,
        option_id: l.optionId ?? null,
        partner_ids: partnerIdsByProduct.get(l.productId) ?? [],
      };
    })
  );

  let { error: itemsError } = await supabase.from("order_items").insert(itemsPayload);
  if (itemsError) {
    // Sloupce product_id/material/variant_id/option_id/partner_ids jsou z
    // novější migrace (2026-08-order-item-product-link.sql) — dokud neproběhla,
    // zkusíme to znovu bez nich, ať objednávka nespadne kvůli chybějícímu sloupci.
    const fallbackPayload = itemsPayload.map(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- tahle pole se schválně zahodí
      ({ product_id, material, variant_id, option_id, partner_ids, ...rest }) => rest
    );
    ({ error: itemsError } = await supabase.from("order_items").insert(fallbackPayload));
  }
  if (itemsError) {
    console.error("objednavka: order_items insert failed", itemsError);
    return NextResponse.json({ error: "Nepodařilo se uložit položky objednávky, zkuste to prosím znovu." }, { status: 500 });
  }

  // Potvrzovací e-mail zákazníkovi — objednávka je v DB hotová bez ohledu na to,
  // jestli se mail povede odeslat, takže selhání tady nesmí shodit odpověď.
  try {
    const { data: settingsRow } = await supabase.from("settings").select("mail").eq("id", 1).single();
    const mail = settingsRow?.mail as MailSettings | undefined;
    if (mail?.host && mail?.user) {
      const orderLabel = order.order_number ? `#${order.order_number}` : `#${order.id.slice(0, 8)}`;
      const subject = `Potvrzení objednávky ${orderLabel} — provlajky.cz`;
      const html = orderConfirmationEmailHtml(
        orderLabel,
        billing,
        lines,
        selectedShipping?.label ?? null,
        shippingPriceEx,
        selectedPayment?.label ?? null,
        paymentPriceEx,
        STANDARD_VAT_RATE
      );
      const transporter = nodemailer.createTransport({
        host: mail.host,
        port: Number(mail.port) || 587,
        secure: !!mail.secure,
        auth: { user: mail.user, pass: mail.pass },
      });
      const fromName = mail.fromName || "PROVLAJKY";
      const fromAddr = mail.from || mail.user;
      try {
        await transporter.sendMail({ from: `"${fromName}" <${fromAddr}>`, to: billing.email, subject, html });
        await supabase.from("email_history").insert({
          sent_by: mail.user,
          kind: "other",
          to_addr: billing.email,
          cc: [],
          bcc: [],
          subject,
          html_body: html,
          attachments_meta: [],
          status: "sent",
        });
      } catch (sendError) {
        const message = sendError instanceof Error ? sendError.message : "Neznámá chyba odeslání.";
        console.error("objednavka: confirmation email failed", sendError);
        await supabase.from("email_history").insert({
          sent_by: mail.user,
          kind: "other",
          to_addr: billing.email,
          cc: [],
          bcc: [],
          subject,
          html_body: html,
          attachments_meta: [],
          status: "failed",
          error_message: message,
        });
      }
    }
  } catch (e) {
    console.error("objednavka: confirmation email step failed", e);
  }

  return NextResponse.json({ orderId: order.id });
}
