# Admin Newsletter Implementation Plan

> **For agentic workers:** Execute task-by-task. Checkboxes track progress. Spec: `docs/superpowers/specs/2026-09-23-admin-newsletter-design.md`

**Goal:** Admin Newsletter (RTS campaigns + coldcall CRM) with Resend delivery and eshop `promo_codes` validation.

**Architecture:** Supabase tables + admin server actions + Resend client; eshop discount validate/checkout checks promo_codes before customers.

**Tech Stack:** Next.js admin/eshop, Supabase, Resend HTTP API, existing `wrapEmailHtml`.

**Spec:** `docs/superpowers/specs/2026-09-23-admin-newsletter-design.md`

## Global Constraints

- Newsletter look must reuse branded shell (`wrapEmailHtml`) like order confirmation.
- Do not show remaining promo uses to customers; validity date OK.
- No cron / automatic sends in v1.
- Without `RESEND_API_KEY`, preview works; send fails with clear Czech error.
- Do not commit unless user asks.

---

### Task 1: SQL migration + types

- [x] Create tables + RLS `is_allowed_user()` + service-role note for eshop claims
- [x] Add TypeScript types

### Task 2: Core libs (CSV, greeting, promo, template, resend, products)

- [x] CSV parse (Name, Email, Country, Phone) filter CZ/SK
- [x] Greeting helper
- [x] Promo code generator + rule normalization
- [x] HTML body builder (products grid + code block)
- [x] Resend client
- [x] Starting price + top products helpers

### Task 3: Server actions

- [x] Riders import/list
- [x] Companies CRUD + status
- [x] Campaign create/preview/send/retry
- [x] Manual coldcall send

### Task 4: Admin UI

- [x] Create: `admin/src/app/(dashboard)/newsletter/**`
- [x] Modify: `admin/src/app/(dashboard)/sidebar.tsx`

### Task 5: Eshop promo integration

- [x] Modify: `eshop/src/app/api/discount/validate/route.ts`
- [x] Modify: `eshop/src/app/api/objednavka/route.ts`
- [x] Optional shared helper under `eshop/src/lib/promo-codes.ts`

### Task 6: Dependency + verify

- [x] Fetch-only Resend client (no npm package)
- [x] `tsc` / lint on touched packages

## Handoff for user

1. Run `admin/supabase/2026-09-newsletter.sql` in Supabase SQL editor
2. Set `RESEND_API_KEY`, `RESEND_FROM_EMAIL` on admin deploy / `.env.local`
3. Import RTS CSV and send a test mail to yourself
