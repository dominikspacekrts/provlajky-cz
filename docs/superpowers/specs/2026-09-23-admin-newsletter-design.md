# Admin Newsletter — Design Spec

**Date:** 2026-09-23  
**Status:** Approved (chat) + build without Resend credentials  
**Repo:** PROVLAJKY admin + eshop

## Goal

Sekce Newsletter v adminu: personalizované kampaně pro jezdce RTS (CZ/SK) se slevovými kódy, a coldcall CRM firem s ručním / hromadným odesíláním. Odesílání newsletterů přes Resend; transakční maily zůstávají na SMTP.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Transport | Resend for newsletters; existing SMTP for orders/invoices |
| Rider import | CSV (same columns as mailovy_klient) → admin |
| Promo codes | Separate `promo_codes` table (not `customers`) |
| Code rules | Per send: one-shot + validity days **or** max uses (+ optional expiry) |
| Products in mail | Manual pick 3–6 + button “load top products” |
| Language | Czech body; greeting by country (CZ/SK) |
| Coldcall v1 | Full CRM (name, phone, email, status, notes) + manual single mail + manual bulk by status filter |
| Automation | **Out of scope** — no cron |
| Customer-facing remaining uses | **Do not show**; validity date OK |
| Email look | Same branded shell as order confirmation (`wrapEmailHtml`: logo, yellow bar, footer) |

## Architecture

```
Admin /newsletter
  ├─ Tab RTS: riders CRUD + CSV import + campaign composer + batch send
  └─ Tab Coldcall: companies CRM + statuses + manual/bulk send
        │
        ▼
  promo_codes + newsletter_* tables (Supabase)
        │
        ▼
  Resend API  ──►  rider / company inbox
        │
  eshop checkout validates promo_codes (then falls back to customers.discount_code)
```

## Data model

### `newsletter_riders`
- id, name, email (unique ci), country (`CZ`|`SK`|…), phone, event_label, created_at, updated_at
- Import upserts on email

### `coldcall_companies`
- id, name, phone, email (nullable), note, status, default_discount_type, default_discount_value, created_at, updated_at, last_contacted_at
- Status enum: `nova` | `zavolano` | `poslat_email` | `nemaji_zajem` | `jedname` | `zakaznik`

### `promo_codes`
- id, code (unique upper), discount_type (`percent`|`fixed`), discount_value
- max_uses (nullable; null + one_shot false = unlimited until expiry — prefer always set max_uses or one_shot)
- one_shot boolean (convenience: max_uses=1)
- valid_until timestamptz nullable
- used_count int default 0
- source (`rts`|`coldcall`|`manual`), rider_id, company_id, campaign_id nullable
- created_at

Customer never sees remaining uses — only admin and optional valid_until in mail/checkout message.

### `newsletter_campaigns`
- id, kind (`rts`|`coldcall`), subject, body_html (intro text), product_ids uuid[], code_rules jsonb, status (`draft`|`sending`|`sent`|`partial`|`failed`), created_at, sent_at

### `newsletter_sends`
- id, campaign_id, recipient_email, recipient_name, rider_id/company_id, promo_code_id, resend_id, status (`sent`|`failed`|`skipped`), error_message, sent_at

## UI

- Sidebar: Newsletter → `/newsletter`
- RTS: import → list → compose (subject, intro, products, code rules) → preview → send with progress; retry failed
- Coldcall: add/edit company, inline status, detail with send form; bulk campaign filtered by status

## Sending

- Env: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` (and optional `RESEND_FROM_NAME`)
- Without key: preview/test UI works; send returns clear error asking for credentials
- Rate-limit sends; log each attempt; partial campaigns resumable for failed only
- Manual coldcall send may optionally flip status to `jedname`

## Eshop

- `POST /api/discount/validate`: try `promo_codes` first, then `customers`
- Checkout claim: atomic used_count increment / one_shot; for `fixed`, convert to effective `discount_pct` from cart subtotal at order time (no new order columns in v1)
- Message may include valid_until; never remaining uses

## Out of scope (v1)

- Cron / drip automation
- Full SK template translation
- Marketing unsubscribe / consent UI
- Deep open/click analytics beyond Resend dashboard

## Blocked on user later

1. Run SQL migration in Supabase
2. Resend account, verify domain, provide `RESEND_API_KEY` + from address
3. Export/import first RTS CSV when ready
4. Confirm coldcall status labels if copy should change
