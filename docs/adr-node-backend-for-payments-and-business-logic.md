# ADR: Node.js Backend Owns Payments (and, Later, Business Logic)

**Status:** Accepted
**Date:** 2026-08-13
**Applies to:** `figapp-backend` (payments/mobile API), `figapp-new` (web, Supabase Edge Functions)

---

## Decision

- **GoCardless payment integration lives in `figapp-backend` (Node/Fastify on Railway)** — not in Supabase Edge Functions.
- **Schema/migrations stay in `figapp-new`** for now (single source of truth, unchanged by this decision).
- **Supabase Edge Functions currently used by the web app will migrate to this backend gradually, function-by-function, after the mobile app ships** — not a big-bang rewrite.
- **Migration ownership (schema) may move to `figapp-backend` later**, only once most business logic has already moved here — sequenced, not immediate.

This is not "Node is universally the best backend" — it's the lowest-risk option given our specific constraints. Reasoning below.

---

## Why Node for payments specifically

| Reason | Detail |
| --- | --- |
| **Official SDK requirement** | `gocardless-nodejs` is Node-only. Supabase Edge Functions run on Deno — using GoCardless there means an unofficial/compat-mode SDK for code that handles money and webhook signatures. Not an acceptable risk. |
| **Webhook reliability** | GoCardless expects fast, consistent responses and retries with backoff if slow. Serverless functions cold-start; a persistent Fastify service doesn't. |
| **No execution time ceiling** | Dunning retries, batch webhook processing, and subscription sync have no artificial timeout on Node, unlike Edge Function invocation limits. |
| **Reuses an already-audited security pattern** | JWT-forward + RLS + explicit-authz-before-privileged-write is the same pattern proven during the Edge Functions security remediation (see `Mobile/Edge-Functions-Security-Findings.md`). Payments reuse a reviewed pattern instead of inventing a new one. |
| **Testability** | Existing Vitest setup (`tests/lib`, `tests/services`) makes pence/pro-rata/seat math straightforward to unit test — critical for billing correctness. |
| **Consistent error/logging conventions** | Stable error-code vocabulary, redacted logging, `x-request-id` tracing, graceful shutdown already exist here. Billing inherits them for free instead of Edge Functions needing their own conventions. |
| **Unifies web + future mobile billing** | Both clients call the same `/billing/*` API instead of duplicating charge/mandate logic per client/runtime. |

---

## Why the Edge Functions migration is phased, not immediate

- Rewriting live, working Edge Functions **during** a mobile launch + payments rollout is unnecessary risk, not caution.
- Sequencing: **ship mobile → stabilize → migrate Edge Functions one at a time, prioritized by complexity/risk** (complex business logic first, trivial pass-through functions last or never).
- Functions triggered directly by **Postgres triggers/webhooks** (not called from a frontend) need re-wiring to a Database Webhook → Node endpoint — flagged as a migration-time consideration, not a blocker today.

---

## Why migrations stay in `figapp-new` for now

- Both `figapp-backend` and `figapp-new` share **one** Supabase Postgres project — there must only ever be **one** canonical source of migrations at a time to avoid schema drift.
- `figapp-new` owns it today because most schema changes are still driven from there.
- Once most business logic (and therefore most schema-driving changes) has moved to `figapp-backend`, migration ownership should follow — but only as a deliberate follow-on step, not before.

---

## What this is not

- Not a claim that Edge Functions are bad — they're fine for functions that stay simple, low-risk, and DB-adjacent.
- Not a rejection of Supabase — Postgres, Auth, Storage, and RLS remain the data/auth layer regardless of where business logic runs.
- Not irreversible — this is a documented, revisitable decision, not a one-way door.

---

## References

- `docs/gocardless-billing-nodejs-handoff.md` — implementation handoff for this backend
- `figapp-new/docs/gocardless-billing-management-questions.md` — agreed product rules
- `figapp-backend/CLAUDE.md` — architecture rationale ("Supabase Edge Functions are NOT used for mobile... for maintainability, testability, and billing predictability")
- `Mobile/Edge-Functions-Security-Findings.md`, `Mobile/FigApp-Security-Remediation-Plan.md` — prior security audit this pattern is based on
