# Billing API reference

Human-readable contract for FigApp GoCardless billing on this backend.  
Live shapes also appear in Swagger: `GET /docs` (when `ENABLE_DOCS` is on, default in development).  
TypeScript: `src/types/billing.ts`. Product rules: `docs/gocardless-billing-nodejs-handoff.md`.

Auth for all routes below except the webhook: `Authorization: Bearer <Supabase access_token>`.

Money is always **integer pence** (GBP). £1.00 = `100`. Display as `amountPence / 100`.

---

## Endpoints

| Method | Path | Who | Purpose |
| --- | --- | --- | --- |
| `GET` | `/billing/access` | Any signed-in user | App gate: may they use FigApp? |
| `GET` | `/billing/agencies/:agencyId/summary` | Primary agency admin or superadmin | Payment-screen quote |
| `POST` | `/billing/agencies/:agencyId/billing-request` | Same | Start GoCardless hosted Direct Debit |
| `POST` | `/billing/agencies/:agencyId/seat-charges` | Same | Mid-cycle extra seats (pro-rata one-off) |
| `POST` | `/webhooks/gocardless` | GoCardless only (signature) | Sync mandate / payment |
| `POST` | `/internal/billing/collect` | Cron (`x-billing-cron-secret`) | Missing licence one-offs + 28-day dunning |

`:agencyId` is a **path param** (`agencies.id` UUID). Get it from `GET /profile` → `agency.id`.  
`GET /billing/access` does **not** take `agencyId`; it uses the JWT user’s agency.

---

## `agency_billing_status`

Stored on `agencies.billing_status`.

| Status | Meaning | `canUseApp` | `needsPaymentSetup` |
| --- | --- | --- | --- |
| `pending_setup` | Commercial agency, no usable Direct Debit mandate yet | `false` | `true` |
| `active` | Mandate set up (first DD may still be pending) | `true` | `false` |
| `past_due` | A collection failed; 28-day grace (dunning cron later) | `true` | `false` |
| `suspended` | Unpaid after grace (day 29) | `false` | `false` |
| `billing_exempt` | Demo / internal; skip GoCardless | `true` | `false` |

`billingExempt: true` is treated like `billing_exempt` even if status were still `pending_setup`.

Existing agencies were seeded exempt so they stay usable until commercial onboarding.

---

## `GET /billing/access`

Gate for **mobile and web**. Not “fetch agency id” (use `/profile` for that). `agencyId` is included as a convenience.

```json
{
  "agencyId": "uuid | null",
  "billingExempt": false,
  "billingStatus": "pending_setup",
  "canUseApp": false,
  "needsPaymentSetup": true
}
```

| Field | Meaning |
| --- | --- |
| `agencyId` | Caller’s `agency_users.agency_id`, or `null` (e.g. superadmin with no agency) |
| `billingExempt` | Demo agency; no GoCardless |
| `billingStatus` | See table above |
| `canUseApp` | Allow the rest of the product |
| `needsPaymentSetup` | Show Direct Debit setup (`pending_setup` only) |

Platform admin with no agency: `canUseApp: true`, `billingStatus: "billing_exempt"`, `agencyId: null`.

---

## `GET /billing/agencies/:agencyId/summary`

Payment screen. Quote is the **starter pack**, not mid-cycle seat adds.

Starter pack: 1 Agency Admin + 1 SW Manager + 1 Social Worker + 10 Foster Carers.

Foster line: 1st seat at `price_monthly`, remaining at `price_additional` (e.g. £20 + 9×£5 = £65). `unitAmountPence` on that line is the **blended** per-seat display amount.

```json
{
  "agencyId": "…",
  "agencyName": "…",
  "billingExempt": true,
  "billingStatus": "billing_exempt",
  "mandateExists": false,
  "mandateStatus": null,
  "setupFeeSelected": false,
  "lineItems": [
    {
      "code": "agency_admin",
      "label": "Agency Admin",
      "quantity": 1,
      "unitAmountPence": 6000,
      "amountPence": 6000
    }
  ],
  "monthlyTotalPence": 20000,
  "setupFeePence": 0,
  "dueNowPence": 20000,
  "billingCycleAnchor": null,
  "currentPeriodStart": null,
  "currentPeriodEnd": null
}
```

| Field | Meaning |
| --- | --- |
| `mandateExists` | Usable Bacs mandate on file (`pending_submission`, `submitted`, `active`, `reinstated`) |
| `mandateStatus` | GoCardless mandate status, or `null` |
| `setupFeeSelected` | Superadmin opted in optional £499 setup/migration fee |
| `lineItems[].code` | `agency_admin` \| `social_worker_manager` \| `social_worker` \| `foster_carer` \| `setup_fee` |
| `lineItems[].quantity` | Seats (or `1` for setup fee) |
| `lineItems[].unitAmountPence` | Per-unit pence (foster = blended) |
| `lineItems[].amountPence` | Line total pence |
| `monthlyTotalPence` | Recurring licences only (no setup fee) |
| `setupFeePence` | One-time fee after discount; `0` if not selected / 100% off / exempt |
| `dueNowPence` | `monthlyTotalPence + setupFeePence` (first-payment presentation) |
| `billingCycleAnchor` | Monthly anniversary = date of **first successful payment** (set by webhook) |
| `currentPeriodStart` / `End` | Current cycle dates (set with the anchor) |

Exempt agencies still return a quote so the UI can show prices; they must **not** call billing-request (`400`).

**403** if the caller is not primary admin / superadmin.

---

## `POST /billing/agencies/:agencyId/billing-request`

Starts GoCardless hosted checkout. Does **not** unlock the app; the webhook does after mandate setup.

**Body**

| Field | Required | Meaning |
| --- | --- | --- |
| `successRedirectUrl` | yes | Absolute URL after the payer finishes (`https://…`, or `http://localhost…` in development) |
| `exitRedirectUrl` | no | If they abandon the flow; defaults to `successRedirectUrl` |

**200**

| Field | Meaning |
| --- | --- |
| `billingRequestId` | GoCardless Billing Request id (`BRQ…`) |
| `authorisationUrl` | Redirect the browser here |
| `expiresAt` | When that hosted flow expires |

| Status | When |
| --- | --- |
| `400` | Exempt agency, or invalid redirect URL |
| `403` | Not primary admin / superadmin |
| `409` | Usable mandate already exists |

Needs `GOCARDLESS_ACCESS_TOKEN` + `SUPABASE_SERVICE_ROLE_KEY`.

---

## `POST /webhooks/gocardless`

No JWT. Header `Webhook-Signature` must match `GOCARDLESS_WEBHOOK_SECRET`.

GoCardless must reach a public URL (ngrok locally). Do not fake this from Postman unless you HMAC the **raw** body.

| After event | What we persist |
| --- | --- |
| Usable mandate | `billing_payment_methods`; `billing_status` `pending_setup` → `active`; **one-off** licence payment; optional setup-fee payment |
| Mandate cancelled / failed / expired / blocked / consumed | Payment method marked unusable; commercial agencies with **no other usable mandate** → `pending_setup` (`canUseApp: false`) |
| Payment `confirmed` / `paid_out` | Invoice paid; first success sets `billing_cycle_anchor` |
| Payment failed | `billing_status` → `past_due` (mandate still live; not the same as mandate cancelled) |

FigApp owns the monthly calendar. There is **no** GoCardless subscription.

`POST /internal/billing/collect` (header `x-billing-cron-secret`):

1. Creates missing licence one-offs.
2. For `past_due`: weekly reminder emails (days 7/14/21) if `RESEND_API_KEY` + `BILLING_FROM_EMAIL` are set; **always** sets `suspended` + `suspended_at` on day 29.

`POST /billing/agencies/:agencyId/seat-charges` body `{ "licenceCode": "foster_carer", "quantity": 1 }`. Requires a usable mandate and `current_period_*` dates. Charges remaining days this cycle, then increments `tenant_licences.seats_purchased`.

---

## Errors (all JSON APIs)

```json
{
  "statusCode": 401,
  "code": "UNAUTHORIZED",
  "message": "…"
}
```

`code`: `VALIDATION_ERROR` | `BAD_REQUEST` | `UNAUTHORIZED` | `FORBIDDEN` | `NOT_FOUND` | `CONFLICT` | `INTERNAL_ERROR`.
