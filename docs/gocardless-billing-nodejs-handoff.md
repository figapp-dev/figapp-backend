# GoCardless Billing — Node.js Backend Handoff

**Audience:** Cursor / engineers working in `figapp-backend` (Fastify on Railway)  
**Sibling web repo:** `figapp-new` (React + Vite + Supabase)  
**Status:** Schema + calculator already landed in web repo. Payment APIs should be built **here**.

**API field / status catalogue:** `[docs/billing-api.md](./billing-api.md)` (endpoints, `billing_status`, pence, request/response fields). Live OpenAPI: `GET /docs`.

---

## 1. Decision (locked)


| Topic                                                | Decision                                                                                |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Provider                                             | **GoCardless only** — UK Direct Debit (Bacs). **No Stripe. No cards.**                  |
| Schema / migrations                                  | `Stay` in `figapp-new` (`supabase/migrations`). Do **not** invent parallel schema here. |
| Payment / webhook / charge APIs                      | `figapp-backend` (this repo)                                                            |
| Web UI (create agency, payment screen, Billing page) | `figapp-new` — calls this API                                                           |
| Mobile (Flutter)                                     | **No payment UI for now.** Only check subscription / billing access.                    |
| Official SDK                                         | `[gocardless-nodejs](https://github.com/gocardless/gocardless-nodejs)`                  |




### Why Node owns payments

- Official GoCardless Node SDK
- Same Railway service as daily-logs (secrets, cron later for dunning)
- Web + future mobile share one billing API surface

---



## 2. Product rules (must follow)

Full management doc (source of truth in web repo):  
`figapp-new/docs/gocardless-billing-management-questions.md`


| Rule                            | Detail                                                              |
| ------------------------------- | ------------------------------------------------------------------- |
| Payer                           | Agency only (Primary Agency Admin sets up DD)                       |
| Cycle                           | Monthly from **first successful payment** date. FigApp cron creates one-off GC payments (no GC subscription). |
| Starter pack (minimum)          | 1 Agency Admin + 1 SW Manager + 1 Social Worker + 10 Foster Carers  |
| Trial                           | None                                                                |
| Access                          | Allowed after **mandate** is set up (first DD may still be pending) |
| Closing payment without mandate | Must **not** unlock the app                                         |
| Mid-cycle add                   | Pro-rata by remaining days in current cycle                         |
| Reduce unused seats             | Next bill only; floor = starter pack; no mid-cycle refund           |
| Disable user                    | Seat stays purchased                                                |
| Children / parents              | Free                                                                |
| Demo agencies                   | `billing_exempt` — skip GoCardless                                  |
| Failed payment                  | 28-day grace, weekly retry + emails, suspend day 29                 |
| Setup fee                       | Optional one-time **£499 GBP**, discount 0–100%                     |




### Seat availability

```text
available = seats_purchased − (seats_used + pending_invites_for_role)
```



### Role → licence code


| App role                     | `licence_types.code`    |
| ---------------------------- | ----------------------- |
| `agency_admin`               | `agency_admin`          |
| `sw_manager`                 | `social_worker_manager` |
| `social_worker`              | `social_worker`         |
| `foster_carer`               | `foster_carer`          |
| child / parent / super_admin | not billable            |


---



## 3. What already exists (do not rebuild)



### In Supabase (applied via web repo migrations)

- Agency columns: `billing_exempt`, `billing_status`, setup fee fields, cycle dates, `past_due_since`, `suspended_at`
- Tables: `billing_customers`, `billing_payment_methods`, `billing_subscriptions`, `billing_events`, `billing_seat_changes`
- Invoice columns: `gocardless_payment_id`, `gocardless_subscription_id`, `line_items`
- Enum `agency_billing_status`: `pending_setup` | `active` | `past_due` | `suspended` | `billing_exempt`
- RPC `create_agency_with_primary_admin` extended with billing options + starter-pack seat seed



### In web repo (copy / port calculator into this backend)

Path: `figapp-new/modules/billing/utils/billingCalculator.ts`

Port into e.g. `src/lib/billing-calculator.ts` (or `src/services/billing/calculator.ts`). Keep behaviour identical (pence math, starter pack, pro-rata, setup fee).

---



## 4. Architecture

```text
Web (figapp-new)
  Authorization: Bearer <Supabase JWT>
  VITE_FIGAPP_API_URL ──► figapp-backend (Railway)
                              │
                              ├── GoCardless API (gocardless-nodejs)
                              └── Supabase Postgres (forward user JWT for user routes;
                                  service_role only for webhook + privileged writes)

Mobile (Flutter)
  Login + features only
  Read agencies.billing_status (or GET /billing/access) — NO payment screens

GoCardless Dashboard
  Webhooks ──► POST https://<railway-host>/webhooks/gocardless
```



### Auth / security (same as daily-logs)

1. User-facing billing routes: `requireAuth` + forward JWT → RLS.
2. Derive agency/role from DB for the verified user — never trust body `agencyId` alone.
3. Primary Agency Admin (or superadmin) only for payment setup / seat charge.
4. Webhooks: verify GoCardless signature; **no JWT**; use service role carefully after signature OK.
5. Never put `GOCARDLESS_ACCESS_TOKEN` in the web or Flutter clients.



### CORS (required for web)

Railway env:

```bash
CORS_ORIGINS=https://<production-web-host>,http://localhost:5173
```

Flutter native does not need CORS. Web browser does.

### Web env (figapp-new)

```bash
VITE_FIGAPP_API_URL=https://api.figapp.co.uk   # or Railway URL
```

---



## 5. GoCardless setup checklist


| Item                   | Where                                                  |
| ---------------------- | ------------------------------------------------------ |
| Sandbox access token   | Railway secret `GOCARDLESS_ACCESS_TOKEN`               |
| Environment            | `GOCARDLESS_ENV=sandbox` (later `live`)                |
| Webhook endpoint       | GC dashboard → `POST /webhooks/gocardless` on this API |
| Webhook signing secret | Railway `GOCARDLESS_WEBHOOK_SECRET`                    |


SDK sketch:

```ts
import gocardless from "gocardless-nodejs";
import { Environments } from "gocardless-nodejs/constants";

const client = gocardless(
  process.env.GOCARDLESS_ACCESS_TOKEN!,
  process.env.GOCARDLESS_ENV === "live" ? Environments.Live : Environments.Sandbox,
  { raiseOnIdempotencyConflict: true },
);
```

Amounts in GoCardless are **pence** (integer). Currency **GBP**. Scheme **bacs** (UK).

---



## 6. Suggested folder layout (match existing style)

```text
src/
  routes/billing.ts              # authenticated billing HTTP
  routes/webhooks-gocardless.ts  # public webhook (signature only)
  services/billing/
    summary.ts
    billing-request.ts
    subscription.ts
    seat-charge.ts
    webhook-handlers.ts
    access.ts                    # mobile/web gate helper
  repositories/billing.ts
  lib/billing-calculator.ts      # port from figapp-new
  schemas/billing.ts
  types/billing.ts
  mappers/billing.ts
```

Register routes in `src/routes/index.ts` like daily-logs.

---



## 7. API surface to implement



### Phase A — Access + summary (start here)



#### `GET /billing/access`

**Auth:** required  
**Purpose:** Mobile + web gate. No GoCardless call.

Response example:

```json
{
  "agencyId": "…",
  "billingExempt": false,
  "billingStatus": "pending_setup",
  "canUseApp": false,
  "needsPaymentSetup": true
}
```

Suggested rules:


| Condition                                   | `canUseApp`                                                                                   |
| ------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `billing_exempt` or status `billing_exempt` | true                                                                                          |
| `active`                                    | true                                                                                          |
| `past_due` (within grace)                   | true (until day 29 suspend)                                                                   |
| `pending_setup`                             | false (unless product allows limited pre-mandate — currently: mandate required before unlock) |
| `suspended`                                 | false                                                                                         |


**Product note:** After mandate is active, allow app even if first payment pending → treat mandate-present + status moved off `pending_setup` (e.g. to `active` while first DD clears) as usable.

#### `GET /billing/agencies/:agencyId/summary`

**Auth:** Primary Agency Admin of that agency (or superadmin)  
**Purpose:** Payment screen line items.

Returns:

- starter pack quantities × prices from `licence_types`
- `monthlyTotalPence`
- optional setup fee pence (from agency `setup_fee_*` columns)
- current `billingStatus`, whether mandate exists

Use ported `quoteStarterPack` / calculator helpers.

---



### Phase B — Onboarding (Billing Request Flow)



#### `POST /billing/agencies/:agencyId/billing-request`

**Auth:** Primary Agency Admin  
**Body (optional):** `{ "successRedirectUrl": "…", "exitRedirectUrl": "…" }`

Flow:

1. Reject if `billing_exempt`.
2. Ensure / create GoCardless customer → upsert `billing_customers`.
3. Create **Billing Request** (customer + mandate + optionally payment/subscription collect) via GC.
4. Return hosted flow URL / billing request id for the web UI to redirect.
5. Persist any pending ids in DB as needed (`billing_events` or columns on customer).

After user completes GC hosted flow (webhook or poll):

1. Store mandate → `billing_payment_methods`
2. Create a **one-off** GC payment for the current seat total (`amount_pence`). FigApp cron creates later months.
3. If `setup_fee_selected` and fee > 0 → create one-off GC **payment** against mandate
4. Set agency usable (mandate OK): leave `pending_setup` → allow access; set `billing_cycle_anchor` only when **first payment confirmed** via webhook



#### Redirect / return URLs

Web owns pages like `/billing/setup/complete`. Pass absolute URLs into Billing Request create.

---



### Phase C — Webhooks (required before trusting state)



#### `POST /webhooks/gocardless`

**Auth:** none (signature verification only)

1. Verify `Webhook-Signature` with `GOCARDLESS_WEBHOOK_SECRET` (SDK helper).
2. For each event:
  - Insert `billing_events` with unique `event_id` (idempotent — ignore duplicates).
  - Process:
    - mandate active / cancelled / failed
    - payment confirmed → set `billing_cycle_anchor` if first paid; invoice row; clear past_due
    - payment failed → set `past_due` / `past_due_since`
    - leftover GC subscription events → sync `billing_subscriptions.status` if present
3. Mark `processed_at` or `processing_error`.

**Exit criteria:** Sandbox mandate + subscription payments update DB correctly.

---



### Phase D — Seat charge (later; web invite oversell)



#### `POST /billing/agencies/:agencyId/seat-charges`

Body: `{ "licenceCode": "foster_carer", "quantity": 1 }`

1. Compute pro-rata with calculator + current period dates.
2. Create one-off GC payment on saved mandate.
3. On success (or pending as product decides): bump `tenant_licences.seats_purchased`, write `billing_seat_changes`, update subscription amount.

Mobile does **not** call this in v1.

---



### Phase E — Dunning (later)

Railway cron or internal route:

- Weekly retry / email for `past_due`
- Suspend after 28 days → `billing_status = suspended`, `suspended_at = now()`

---



## 8. Mobile vs web responsibilities


| Client       | Billing work                                                                                                                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mobile**   | Call `GET /billing/access` (or read `agencies.billing_status` via existing patterns). Block app features if `canUseApp === false`. No mandate UI. |
| **Web**      | Full payment UI; call summary + billing-request; redirect to GoCardless; handle return; Billing page later.                                       |
| **This API** | All GoCardless secrets, webhooks, charges, subscription updates.                                                                                  |


---



## 9. DB tables quick map


| Table                     | Use                                              |
| ------------------------- | ------------------------------------------------ |
| `agencies`                | `billing_status`, exempt, setup fee, cycle dates |
| `licence_types`           | Catalogue prices                                 |
| `tenant_licences`         | `seats_purchased` / `seats_used` per agency      |
| `billing_customers`       | agency ↔ GC customer id                          |
| `billing_payment_methods` | mandate id, bank hint, status                    |
| `billing_subscriptions`   | GC subscription id, `amount_pence`, status       |
| `billing_events`          | webhook audit + idempotency (`event_id` unique)  |
| `billing_seat_changes`    | pro-rata adds / scheduled reductions             |
| `invoices`                | optional mirror of payments + `line_items`       |


RLS today: agency members **read** billing tables; superadmin full. Writes from this API for webhooks/charges will need **service role** after authz checks (same privileged pattern as noted in `CLAUDE.md`).

---



## 10. Implementation order (recommended)

1. Env + `gocardless-nodejs` dependency + thin GC client wrapper
2. Port `billingCalculator` + unit tests
3. `GET /billing/access` + `GET /billing/agencies/:agencyId/summary`
4. `POST /webhooks/gocardless` (idempotent store + mandate/payment handlers)
5. `POST /billing/agencies/:agencyId/billing-request` + subscription / setup fee on mandate ready
6. Wire web app (`VITE_FIGAPP_API_URL`) payment screen
7. Seat-charge API + web invite oversell (later)
8. Dunning cron (later)

---



## 11. Env vars (Railway)

```bash
# existing
SUPABASE_URL=
SUPABASE_PUBLISHABLE_KEY=
# privileged writes for webhooks / GC sync (add if not present)
SUPABASE_SERVICE_ROLE_KEY=

CORS_ORIGINS=https://<web-host>,http://localhost:5173

GOCARDLESS_ACCESS_TOKEN=sandbox_…
GOCARDLESS_WEBHOOK_SECRET=…
GOCARDLESS_ENV=sandbox
BILLING_CRON_SECRET=
```

---



## 12. References in web repo


| Doc / file                                                              | Purpose                                      |
| ----------------------------------------------------------------------- | -------------------------------------------- |
| `docs/gocardless-billing-management-questions.md`                       | Agreed product rules                         |
| `docs/billing-implementation-plan.md`                                   | Phased plan (update runtime → this Node API) |
| `modules/billing/utils/billingCalculator.ts`                            | Pricing / seat math to port                  |
| `supabase/migrations/20260812155523_gocardless_billing_foundations.sql` | Schema                                       |
| `supabase/migrations/20260813100000_create_agency_billing_options.sql`  | Create-agency billing seed                   |


---



## 13. Out of scope for this backend milestone

- Flutter payment / GoCardless UI  
- Stripe  
- Card payments  
- Changing migration ownership (keep in `figapp-new`)  
- Replacing daily-logs or other mobile APIs

---

When implementing in Cursor on `figapp-backend`, start with Phase A (`/billing/access` + summary) then webhook + Billing Request. Keep routes thin; put GC + DB orchestration in `services/billing/`.