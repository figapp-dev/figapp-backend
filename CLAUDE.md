# FigApp Backend (Node.js) — Project Context for Claude Code

Dedicated Node.js API server for the FigApp mobile app (Flutter, foster carer role first). The developer is writing all implementation code themselves in Cursor — this file is context/reference only. Do not write route/middleware implementation code unless explicitly asked; this doc exists so any assistant helping here (planning, review, debugging) has full background.

---

## What this server is for

FigApp is a multi-tenant SaaS for UK foster care agencies. The existing web app (separate repo, `figapp-new`) is React + Vite + Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), deployed on Vercel.

This backend serves the **mobile app only** (Flutter, foster_carer role first, expanding to other roles later). It is a deliberate architectural choice — Supabase Edge Functions are NOT used for mobile; all mobile business logic goes through this dedicated Node.js server instead, for maintainability, testability, and billing predictability. (The web app currently still uses Edge Functions; migrating those to this same server is a possible future direction, done gradually, function by function — not urgent.)

- Shares the same Supabase Postgres database as the web app — no new DB, no migration.
- Auth: Supabase Auth issues the JWT (same login/users as web app). This server validates that JWT per request.
- **Authorization model: RLS + JWT-forwarding, not JWT-verify-then-bypass.** Every Supabase call this server makes on behalf of a user must forward that user's own JWT (via `createClient(url, anonKey, { global: { headers: { Authorization: 'Bearer ' + token } } })`), so Postgres RLS policies enforce access exactly as they do for the web app. Do not use the `service_role` key for user-scoped requests — only for the rare deliberately-privileged operation, with an explicit authorization check in code first.
- File uploads/downloads: use Supabase Storage **signed URLs** (short-lived), not public bucket URLs — matches the pattern already implemented in the web app's `modules/core/utils/storageUrls.ts`.
- Realtime (FigChat messages, notifications): Flutter subscribes to Supabase Realtime **directly** — this server only handles the write path (validated inserts). Do not build a WebSocket layer here for chat.

## Stack

- Fastify (chosen over Express for schema validation + lower overhead; chosen over NestJS to avoid stacking a second steep learning curve while learning Node.js itself)
- TypeScript (light touch — don't fight the type system early, `any` is an acceptable escape hatch while learning)
- `@supabase/supabase-js` for all DB access (no raw `pg`/ORM — RLS is enforced via the forwarded-JWT client, not by writing SQL directly)
- Vitest for tests
- Deployed on Railway, connected to GitHub for auto-deploy

## Suggested structure

```
src/
  routes/        one file per resource (daily-logs.ts, children.ts, figchat.ts, ...)
  middleware/     jwt-auth.ts — verify JWT, attach per-request Supabase client to the request
  lib/            supabase.ts (client factory), authz.ts (shared role/agency-scope checks)
  server.ts
```

## Security pattern to follow everywhere (non-negotiable)

This mirrors the pattern already verified correct in the web app's Edge Functions after a full security remediation pass:
1. Verify the caller's JWT via `supabase.auth.getUser(token)` — never trust a body field for identity.
2. Derive role/agency from the caller's own verified id (`agency_users` / `global_user_roles` tables), never from client-supplied input.
3. Check the caller is actually authorized for the specific action + specific target (not just "is logged in").
4. Only after that, perform the privileged action.

## Build order (milestones — daily logs first, matching the mobile MVP)

1. Scaffold + `/health` route + deploy to Railway (prove the pipeline before writing real logic)
2. JWT-verification middleware + forwarded Supabase client, proven via `GET /profile`
3. Children endpoints: `GET /children`, `GET /children/:id` (full profile — allergies, medical, emergency contacts), `GET /children/:id/placements`
4. Daily Logs (core MVP): `GET /daily-log-templates`, `GET/POST/PUT /daily-logs`. **Design for offline sync from the start**: accept a client-generated UUID on create (idempotent retries from Flutter's offline queue), include an `updated_at`/version field for conflict resolution.
5. File uploads: `POST /files/upload` → signed URL
6. `POST /fcm/register` for push notifications
7. Then FigChat send + Tasks + Expenses (Phase 2), then Calendar + Documents + Profile endpoints (Phase 3) — one resource at a time, matching Flutter's build order so neither side races ahead.

## Full endpoint list (current scope, foster_carer role)

- `POST /auth/login` — validate Supabase JWT, return session
- `GET /children` — children assigned to the foster carer
- `GET /children/:id` — full profile: DOB, allergies, medical conditions, emergency contacts, professional contacts, current placement
- `GET /children/:id/placements` — placement history
- `GET /daily-logs`, `POST /daily-logs`, `PUT /daily-logs/:id`, `GET /daily-logs/:id`
- `GET /daily-log-templates` — agency's log form structure
- `GET /figchat/conversations`, `GET /figchat/conversations/:id/messages`, `POST /figchat/conversations/:id/messages`
- `GET /notifications`, `PUT /notifications/:id/read`
- `GET /notification-preferences`, `PUT /notification-preferences`
- `GET/POST/PUT /expense-claims`
- `GET /tasks`, `PUT /tasks/:id`, `POST /tasks/:id/comments`
- `GET /calendar/events`, `POST /calendar/events`, `PUT /calendar/events/:id`
- `GET /documents`, `POST /documents/upload`, `POST /documents/:id/sign`
- `POST /files/upload` — Supabase Storage, returns signed URL
- `GET/PUT /profile`, `GET /profile/carer-details` (training/certification, availability, activity history)
- `GET /household` — co-carers, household's active placements
- `GET/POST /life-story/:childId` — view + carer contribution
- `GET/PUT /gdpr-consent`
- `GET/POST /tickets`, `POST /tickets/:id/comments`

## Reference

Full design/architecture history, RLS audit, and Edge Functions security findings live in the sibling `Mobile/` folder (`CLAUDE.md`, `RLS-Policy-Reference.md`, `RLS-Improvement-Plan.md`, `Edge-Functions-Security-Findings.md`, `FigApp-Security-Remediation-Plan.md`) — worth reading for full context on why the JWT-forwarding pattern and signed-URL approach were chosen, and what was found/fixed on the web app side.
