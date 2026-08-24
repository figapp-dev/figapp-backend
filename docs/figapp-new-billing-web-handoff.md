# FigApp web (figapp-new) — billing handoff

For engineers on **figapp-new**. Payments run on **figapp-backend** (GoCardless UK Direct Debit). The web app is the UI + redirects only.

Production web: `https://www.figapp.co.uk`  
Production API: Railway host (set as `VITE_FIGAPP_API_URL` at **build** time).

Auth: `Authorization: Bearer <Supabase access_token>` on all billing routes except the webhook (backend only).

---

## Already done on web (do not rebuild)

- API client to figapp-backend
- Post-login **access gate** (`GET /billing/access`)
- Payment / Direct Debit setup page
- Start hosted checkout (`POST /billing/agencies/:agencyId/billing-request`)
- Non-admins blocked from payment UI
- Superadmin **demo vs commercial** + optional setup fee (`PATCH .../exemption`)

---

## Bug: after GoCardless, user lands on login

GoCardless hosted checkout is **another origin**. When the payer finishes or exits, GC **redirects the browser** to the URLs **you passed** in billing-request. The API does not send them to `/auth`.

If they see **login**, typical causes:

1. `successRedirectUrl` / `exitRedirectUrl` is `https://www.figapp.co.uk/auth` (or the login route).
2. There is **no** `/billing/complete` (or equivalent) route, so the app’s auth guard treats the return URL as unknown and dumps them on login.
3. The complete page is **behind** “must be logged in” and the session cookie was not sent after the off-site round-trip (less common with SameSite=Lax on a top-level GET). Still: complete page should restore session or show “log in to finish”.

**Fix:** pass dedicated pages, then implement those pages.

### URLs to send on billing-request

Production (https only):

| Field | Example |
| --- | --- |
| `successRedirectUrl` | `https://www.figapp.co.uk/billing/complete` |
| `exitRedirectUrl` | `https://www.figapp.co.uk/billing/setup?reason=exited` |

Local (non-production API only): `http://localhost:<vite-port>/billing/complete` is allowed.

Do **not** use `/auth`, `/login`, or the API host.

Body:

```json
{
  "successRedirectUrl": "https://www.figapp.co.uk/billing/complete",
  "exitRedirectUrl": "https://www.figapp.co.uk/billing/setup?reason=exited"
}
```

Response: `{ "billingRequestId", "authorisationUrl", "expiresAt" }` → `window.location = authorisationUrl`.

---

## Pages the web app must have

### A. Setup — `/billing/setup` (you have this)

- Primary admin: quote (`GET /billing/agencies/:id/summary`) + button to start DD.
- Others: “Ask your agency admin.”
- If `?reason=exited`: “Setup cancelled. You can try again.” App stays locked if still `pending_setup`.

### B. Success — `/billing/complete` (**required**)

GC **does not** mean money is in. It means they **finished hosted DD**. Unlock happens when the **backend webhook** sees a usable mandate.

This page should:

1. Require a session (or “Continue” login that returns here).
2. Poll `GET /billing/access` every 2s for ~30–60s.
3. When `canUseApp === true` → send them into the app.
4. If still `needsPaymentSetup` after timeout → “We’re confirming Direct Debit. Refresh, or contact support.” Do **not** send them to login as the success state.

### C. Failure / abandon

Not a GC “payment failed” page. Closing the hosted flow hits **`exitRedirectUrl`**.

- Show setup again with a clear message.
- Do **not** unlock.

A **bounced collection** later is `billingStatus: "past_due"` — app **stays usable**. That is a banner, not this page.

---

## Access gate (keep using this everywhere)

`GET /billing/access` — no `agencyId` in the URL.

| `billingStatus` | `canUseApp` | `needsPaymentSetup` | Web |
| --- | --- | --- | --- |
| `billing_exempt` | true | false | Normal app |
| `pending_setup` | false | true | Payment setup (first time **or** mandate cancelled) |
| `active` | true | false | Normal app |
| `past_due` | true | false | App + **banner** (28-day grace) |
| `suspended` | false | false | **Blocked** — not the first-time setup screen |

Mandate **cancelled** on the API sets `pending_setup` again. Same setup page, different copy: “Direct Debit was cancelled. Set it up again.”

---

## Remaining web work (priority)

1. **Redirect URLs + `/billing/complete` + exit query** (fixes login-after-DD).
2. **Production** `VITE_FIGAPP_API_URL` + https setup URLs.
3. **`past_due` banner** and **`suspended` lock screen**.
4. **Remove Stripe** billing / card portal if it is still linked.
5. **Mid-cycle seats** (when invites exceed purchased seats):  
   `POST /billing/agencies/:agencyId/seat-charges`  
   `{ "licenceCode": "foster_carer", "quantity": 1 }`  
   Then create the invite. 400 = no period yet; 409 = no mandate; 400 = exempt.

Do **not** call collect or `/webhooks/gocardless` from the browser.

---

## Backend APIs (web)

| Method | Path | Who |
| --- | --- | --- |
| `GET` | `/billing/access` | Any signed-in user |
| `GET` | `/billing/agencies/:agencyId/summary` | Primary admin / superadmin |
| `POST` | `/billing/agencies/:agencyId/billing-request` | Same |
| `PATCH` | `/billing/agencies/:agencyId/exemption` | Platform admin |
| `POST` | `/billing/agencies/:agencyId/seat-charges` | Primary admin / superadmin |

`:agencyId` = `GET /profile` → `agency.id`.

Money is **integer pence**. £200 = `20000`.

---

## What web must not own

- GoCardless secrets, webhooks, cron collect
- Creating GC subscriptions (FigApp sends one-off payments)
- Unlocking the app before `canUseApp === true` from `/billing/access`
