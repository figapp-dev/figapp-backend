# FigApp Backend (Node.js) — Project Context for Claude Code

Dedicated Node.js API server for the FigApp mobile app (Flutter, foster carer role first).

**This is production software**, not an MVP prototype. Assistants must default to production-quality patterns (authz, schemas, errors, tests, ops hardening). Do not suggest “ship basic now, harden later” unless the user explicitly asks for a throwaway spike. The developer often writes implementation themselves in Cursor — this file is context/reference; still treat every change as production-bound.

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

- Fastify (schema validation, low overhead)
- TypeScript
- `@supabase/supabase-js` for all DB access (no raw `pg`/ORM — RLS via forwarded-JWT client)
- Vitest for unit + smoke tests
- Deployed on Railway (GitHub auto-deploy), custom domain e.g. `api.figapp.co.uk`

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
tests/              mirrors src (e.g. tests/lib/..., tests/smoke/...); do not put tests under src/
```

Do not use Prisma/TypeORM `models/` for this project — `@supabase/supabase-js` with forwarded JWT is the data layer so RLS stays enforcement.

## Production ops (required)

- Logger redacts `Authorization` / cookies
- Every response includes `x-request-id` (accept incoming `x-request-id` when present)
- Graceful shutdown on `SIGTERM` / `SIGINT`
- Rate limiting (default 200/min; `/health` excluded)
- CORS: off by default in production unless `CORS_ORIGINS` is set (Flutter native does not need CORS)
- `trustProxy: true` for Railway

## API docs (Swagger)

- Enabled when `ENABLE_DOCS=true`, or by default in non-production
- **Disabled in production** unless explicitly enabled
- UI: `GET /docs` · OpenAPI JSON: `GET /docs/json`
- Authorize with Supabase `access_token` (Bearer)
- Source of truth for Flutter models when docs are enabled; otherwise use committed OpenAPI / staging docs

## Error `code` vocabulary (stable for Flutter)

All errors: `{ statusCode, code, message, ...optional fields }`.

| code | When |
|------|------|
| `VALIDATION_ERROR` | Fastify/Ajv schema failure (friendly message) |
| `VALIDATION_FAILED` | Submit missing required fields (+ `missingFieldIds`) |
| `EXPECTED_UPDATED_AT_REQUIRED` | Log exists but PUT omitted lock (+ `currentUpdatedAt`) |
| `CONFLICT` | Optimistic lock mismatch (+ `currentUpdatedAt`) |
| `BAD_REQUEST` | Other 400s |
| `UNAUTHORIZED` / `FORBIDDEN` / `NOT_FOUND` / `INTERNAL_ERROR` | Standard |

## Deploy (Railway)

Repo is intended for GitHub → Railway auto-deploy.

**Required Railway Variables** (Dashboard → Variables):
- `SUPABASE_URL` (must be `https://…`)
- `SUPABASE_PUBLISHABLE_KEY`
- `NODE_ENV=production` (Railway often sets this)
- `PORT` — do not set; Railway injects it

**Optional:** `ENABLE_DOCS`, `CORS_ORIGINS`, `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW`

**Config:** `railway.toml` builds with `npm run build` only (Nixpacks already runs `npm ci`; do not duplicate it — causes EBUSY), starts with `npm start`, healthchecks `GET /health`.

**Local env:** copy `.env.example` → `.env` (gitignored).

After deploy, confirm: `https://api.figapp.co.uk/health` (or Railway host) → `{ "status": "ok", ... }`.

## Tests

- Unit: `tests/lib/**`, `tests/services/**`
- Smoke: `tests/smoke/api.smoke.test.ts` — `/health`, 401 on protected routes
- Run: `npm test`

## New resource checklist (every API)

When adding FigChat, tasks, expenses, FCM, etc., ship **in the same change**:

1. `routes/<resource>.ts` — thin HTTP + `requireAuth` + Fastify schema for writes
2. `services/<resource>/` (or file, then folder when it grows) — rules only, **no** `.from()`
3. `repositories/<resource>.ts` — all Supabase/Storage I/O
4. `mappers/<resource>.ts` — row → camelCase DTO
5. `schemas/<resource>.ts` — write body schemas
6. `types/<resource>.ts` — DTOs + row types
7. `ErrorMessages` entries + `AppError` helpers + reuse `lib/households`, UK date helpers, `tables.ts`
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
7. FigChat send — **done**. Calendar (`/calendar/events`, `/calendar/eligible-participants`) — **done**, full web parity (recurrence, reminders, participant invites, RSVP, edit-scope). Note: "Tasks" (`TaskManagement.tsx` on web) is `super_admin`/`app_admin`-only and is **not** a foster_carer feature — don't build a `/tasks` endpoint for this app. Remaining, in the web sidebar's foster_carer order: Documents, My Household, Life Story, My Placements, Platform Support (tickets), Survey Center, Expense Claims, Notifications (deliberately last) — one resource at a time, matching Flutter's build order so neither side races ahead.

## Shipped endpoints (foster_carer MVP so far)

Auth: Supabase Auth on the client; send `Authorization: Bearer <access_token>`. No `POST /auth/login` on this server.

- `GET /health` — public
- `GET /docs`, `GET /docs/json` — OpenAPI (Swagger UI)
- `GET /profile` — `id` = auth user id; `agencyUserId` = `agency_users.id`
- `GET /children`, `GET /children/:id`, `GET /children/:id/placements`
- `GET /daily-logs?date=YYYY-MM-DD` — UK date; omit date → today
- `GET /daily-logs/overdue` — incomplete assignments before today (last 90 days, newest first)
- `GET /daily-logs/:id` — assignment detail (template + `dataJson` + contributors)
- `PUT /daily-logs/:id` — save/submit (see Flutter contract below)
- `POST /files/signed-upload-url`, `POST /files/signed-url`
- `GET /calendar/events?from=YYYY-MM-DD&to=YYYY-MM-DD` — events the caller created or is a participant in (default: current UK month). RLS (`events_select_participants_only`) does the access filtering.
- `GET /calendar/eligible-participants` — who the caller can tag/invite: placed children (tag-only), linked foster carers, social workers
- `GET /calendar/events/:id` — detail incl. participants + reminders
- `POST /calendar/events` — create; a `recurrencePattern` is expanded server-side into individual occurrence rows immediately (capped at 52), sharing a `seriesId`
- `PUT /calendar/events/:id` — update; body `editScope` (`single` default | `future` | `series`) controls how a recurring series is affected, mirroring the web app's edit dialog (delta-shift start/end across target rows, full replace of reminders, add/remove diff of participants)
- `DELETE /calendar/events/:id` — deletes a single occurrence, not the whole series
- `POST /calendar/events/:id/rsvp` — accept/decline/tentative on the caller's own invite

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
- FigChat, notifications, expenses, documents
- `GET/PUT /profile` extras (`/profile/carer-details`), household, GDPR, tickets
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
- `GET /calendar/events`, `GET /calendar/events/:id`, `POST /calendar/events`, `PUT /calendar/events/:id`, `DELETE /calendar/events/:id`, `POST /calendar/events/:id/rsvp`, `GET /calendar/eligible-participants` — **shipped**, see Shipped endpoints below
- `GET /documents`, `POST /documents/upload`, `POST /documents/:id/sign`
- `POST /files/signed-upload-url`, `POST /files/signed-url`
- `GET/PUT /profile`, `GET /profile/carer-details` (training/certification, availability, activity history)
- `GET /household` — co-carers, household's active placements
- `GET/POST /life-story/:childId` — view + carer contribution
- `GET/PUT /gdpr-consent`
- `GET/POST /tickets`, `POST /tickets/:id/comments`

## Reference

Full design/architecture history, RLS audit, and Edge Functions security findings live in the sibling `Mobile/` folder (`CLAUDE.md`, `RLS-Policy-Reference.md`, `RLS-Improvement-Plan.md`, `Edge-Functions-Security-Findings.md`, `FigApp-Security-Remediation-Plan.md`) — worth reading for full context on why the JWT-forwarding pattern and signed-URL approach were chosen, and what was found/fixed on the web app side.
