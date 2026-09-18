"use client";

import { useState } from "react";
import { useEmailPreview } from "@/components/email/EmailPreviewProvider";
import { getOrCreateReviewInvite } from "@/lib/actions/reviews";
import { getMailTemplatesForClient } from "@/lib/actions/settings";
import { customerEmail } from "@/lib/domain";
import { DEFAULT_MAIL_TPL_REVIEW, fillTemplate, wrapEmailHtml } from "@/lib/email-templates";
import type { Order, Review } from "@/lib/types";

export default function SendReviewButton({ order, review }: { order: Order; review: Pick<Review, "status" | "rating"> | null }) {
  const { openEmailPreview } = useEmailPreview();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    const to = customerEmail(order);
    if (!to) {
      alert("Objednávka nemá e-mail zákazníka (fakturační adresa → E-mail).");
      return;
    }
    if (review?.status === "submitted" && !confirm("Zákazník už hodnocení vyplnil. Poslat odkaz znovu?")) {
      return;
    }

    setBusy(true);
    try {
      const [invite, tpl] = await Promise.all([getOrCreateReviewInvite(order.id), getMailTemplatesForClient()]);
      openEmailPreview({
        kind: "review_request",
        orderId: order.id,
        to,
        subject: order.order_number
          ? `Jak jste spokojeni s objednávkou č. ${order.order_number}?`
          : "Jak jste spokojeni s objednávkou?",
        html: wrapEmailHtml(
          fillTemplate(DEFAULT_MAIL_TPL_REVIEW, order, "", { link: invite.link }),
          tpl.signName,
          tpl.signPhone
        ),
        attachments: [],
      });
    } catch (e) {
      alert("Chyba přípravy mailu: " + (e instanceof Error ? e.message : String(e)));
    } finally {
      setBusy(false);
    }
  }

  const label =
    review?.status === "submitted"
      ? `Hodnoceno ${"★".repeat(review.rating || 0)}`
      : review
        ? "Poslat hodnocení znovu"
        : "Odeslat hodnocení";

  return (
    <button className="btn" onClick={handleClick} disabled={busy} title="Mail s odkazem na dotazník spokojenosti">
      {busy ? "Připravuji…" : label}
    </button>
  );
}
