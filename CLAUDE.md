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

Prefer a thin three-layer flow (adapted for Supabase JWT/RLS — no ORM):

```
Route → Service (business rules) → Repository (Supabase queries) → Mapper (DTO)
```

```
src/
  routes/           one file per resource; HTTP only (auth hook, schema, status codes)
  plugins/          Fastify plugins (jwt-auth — verify JWT, attach user + supabase client)
  services/         business logic + orchestration (folder per growing resource, e.g. daily-logs/)
  repositories/     Supabase/Storage data access only (children, daily-logs, files, profile — one file per resource)
  mappers/          DB/row → API DTO
  schemas/          Fastify JSON Schema for write bodies
  lib/              shared pure helpers (supabase client factory, tables, status, validation, households)
  types/            DTO + row types
  config/           env
  server.ts / app.ts
tests/              mirrors src (e.g. tests/lib/...); do not put tests under src/
```

Do not use Prisma/TypeORM `models/` for this project — `@supabase/supabase-js` with forwarded JWT is the data layer so RLS stays enforcement.

## API docs (Swagger)

- UI: `GET /docs` (local: http://localhost:8082/docs — use your PORT)
- OpenAPI JSON: `GET /docs/json`
- Authorize in Swagger UI with Supabase `access_token` (Bearer).
- Use these schemas as the source of truth when generating Flutter `*.g.dart` / freezed models (or hand-write from the Schema section).

## Deploy (Railway)

Repo is intended for GitHub → Railway auto-deploy.

**Required Railway Variables** (Dashboard → Variables):
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `NODE_ENV=production` (optional; Railway often sets this)
- `PORT` — do not set; Railway injects it

**Config:** `railway.toml` builds with `npm ci && npm run build`, starts with `npm start`, healthchecks `GET /health`.

**Local env:** copy `.env.example` → `.env` (gitignored).

After deploy, confirm: `https://<your-railway-host>/health` → `{ "status": "ok", ... }`.

## Deferred: API smoke tests

Auth + route smoke tests (unauthenticated → 401, `/health` OK, etc.) are **intentionally deferred**. Implement under `tests/` before wider go-live; not blocking Railway health deploy.

## New resource checklist (every API)

When adding FigChat, tasks, expenses, FCM, etc., ship **in the same change**:

1. `routes/<resource>.ts` — thin HTTP + `requireAuth` + Fastify schema for writes
2. `services/<resource>/` (or file, then folder when it grows) — rules only, **no** `.from()`
3. `repositories/<resource>.ts` — all Supabase/Storage I/O
4. `mappers/<resource>.ts` — row → camelCase DTO
5. `schemas/<resource>.ts` — write body schemas
6. `types/<resource>.ts` — DTOs + row types
7. `ErrorMessages` entries + reuse `lib/households`, UK date helpers, `tables.ts`
8. Vitest under `tests/` for any new pure validation/status helpers
9. Use `serviceFailure` / `serviceSuccess` from `lib/service-result.ts` for mutate/result bags
10. If the resource supports offline edits, expose `updatedAt` on the DTO and accept `expectedUpdatedAt` on writes (409 on mismatch)

Do **not** invent “ensure/create today’s …” endpoints if the web already owns creation unless product explicitly asks.

## Security pattern to follow everywhere (non-negotiable)

This mirrors the pattern already verified correct in the web app's Edge Functions after a full security remediation pass:
1. Verify the caller's JWT via `supabase.auth.getUser(token)` — never trust a body field for identity.
2. Derive role/agency from the caller's own verified id (`agency_users` / `global_user_roles` tables), never from client-supplied input.
3. Check the caller is actually authorized for the specific action + specific target (not just "is logged in").
4. Only after that, perform the privileged action.

## Build order (milestones — daily logs first, matching the mobile MVP)

1. Scaffold + `/health` route + deploy to Railway (prove the pipeline before writing real logic) — **done**
2. JWT-verification middleware + forwarded Supabase client, proven via `GET /profile` — **done**
3. Children endpoints: `GET /children`, `GET /children/:id`, `GET /children/:id/placements` — **done**
4. Daily Logs (core MVP): `GET /daily-logs`, `GET/PUT /daily-logs/:id` (`:id` = **assignment id**). Templates embed on detail (no standalone templates route). Web creates today’s assignments; mobile only reads/writes. Offline: `clientLogId` on first create, `log.updatedAt` / `expectedUpdatedAt` for conflicts — **done**
5. File uploads: `POST /files/signed-upload-url` + `POST /files/signed-url` — **done**
6. `POST /fcm/register` for push notifications
7. Then FigChat send + Tasks + Expenses (Phase 2), then Calendar + Documents + Profile endpoints (Phase 3) — one resource at a time, matching Flutter's build order so neither side races ahead.

## Shipped endpoints (foster_carer MVP so far)

Auth: Supabase Auth on the client; send `Authorization: Bearer <access_token>`. No `POST /auth/login` on this server.

- `GET /health` — public
- `GET /docs`, `GET /docs/json` — OpenAPI (Swagger UI)
- `GET /profile` — `id` = auth user id; `agencyUserId` = `agency_users.id`
- `GET /children`, `GET /children/:id`, `GET /children/:id/placements`
- `GET /daily-logs?date=YYYY-MM-DD` — UK date; omit date → today
- `GET /daily-logs/:id` — assignment detail (template + `dataJson` + contributors)
- `PUT /daily-logs/:id` — save/submit (see Flutter contract below)
- `POST /files/signed-upload-url`, `POST /files/signed-url`

## Flutter contract (daily logs + files)

1. List for a UK day → open assignment → GET detail (template drives the form).
2. `PUT` with `dataJson` (**full replace**), `intent: "save" | "submit"`.
3. First create: optional `clientLogId` (UUID); **omit** `expectedUpdatedAt`.
4. Later saves: **required** `expectedUpdatedAt` = last `log.updatedAt`. Missing → `400 EXPECTED_UPDATED_AT_REQUIRED` (+ `currentUpdatedAt`). Mismatch → `409 CONFLICT`.
5. Submit may return `400 VALIDATION_FAILED` + `missingFieldIds`.
6. Files: `POST /files/signed-upload-url` with `resource: "daily_log"`, assignment `id`, `fieldId`, `fileName` → upload via returned URL/token → store `{ path, name }` (or equivalent) in that field’s `dataJson` value → download later with `POST /files/signed-url` using `bucket` + `path`.
7. UI flags: trust `canEdit` / `isOverdue` from the API (enforced again on PUT).

## Planned endpoints (not built yet)

- `POST /fcm/register`
- FigChat, notifications, expenses, tasks, calendar, documents
- `GET/PUT /profile` extras (`/profile/carer-details`), household, life-story, GDPR, tickets
- Web still owns assignment creation; do not add “ensure today” unless product asks

## Full product endpoint list (target scope, foster_carer)

- `GET /children` — children assigned to the foster carer
- `GET /children/:id` — full profile: DOB, allergies, medical conditions, emergency contacts, professional contacts, current placement
- `GET /children/:id/placements` — placement history
- `GET /daily-logs`, `PUT /daily-logs/:id`, `GET /daily-logs/:id`
- `GET /figchat/conversations`, `GET /figchat/conversations/:id/messages`, `POST /figchat/conversations/:id/messages`
- `GET /notifications`, `PUT /notifications/:id/read`
- `GET /notification-preferences`, `PUT /notification-preferences`
- `GET/POST/PUT /expense-claims`
- `GET /tasks`, `PUT /tasks/:id`, `POST /tasks/:id/comments`
- `GET /calendar/events`, `POST /calendar/events`, `PUT /calendar/events/:id`
- `GET /documents`, `POST /documents/upload`, `POST /documents/:id/sign`
- `POST /files/signed-upload-url`, `POST /files/signed-url`
- `GET/PUT /profile`, `GET /profile/carer-details` (training/certification, availability, activity history)
- `GET /household` — co-carers, household's active placements
- `GET/POST /life-story/:childId` — view + carer contribution
- `GET/PUT /gdpr-consent`
- `GET/POST /tickets`, `POST /tickets/:id/comments`

## Reference

Full design/architecture history, RLS audit, and Edge Functions security findings live in the sibling `Mobile/` folder (`CLAUDE.md`, `RLS-Policy-Reference.md`, `RLS-Improvement-Plan.md`, `Edge-Functions-Security-Findings.md`, `FigApp-Security-Remediation-Plan.md`) — worth reading for full context on why the JWT-forwarding pattern and signed-URL approach were chosen, and what was found/fixed on the web app side.
