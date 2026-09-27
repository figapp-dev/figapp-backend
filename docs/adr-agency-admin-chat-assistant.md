# ADR: Agency Admin Chat Assistant ("Ask Figgy")

Status: approved by management (verbal) -- not yet started
Repos affected: figapp-backend (proposed home for the query endpoint --
see open question in section 8), figapp-new (web admin UI), Supabase
(no schema changes required; RLS already enforced on every candidate table)

## 1. Problem / goal

Agency admins currently have to navigate dashboards/reports to answer
simple operational questions ("how many foster carers do we have",
"who hasn't submitted today's log"). Goal: a chat box in the admin web
app where an admin types a natural-language question and gets a real,
correct answer pulled live from that agency's own Supabase data --
scoped so an admin can never see another agency's data.

Mockup (interactive, click-through): see the shared Artifact link in
the originating conversation ("FigApp Admin Chat -- Mockup").

## 2. Approach decision

**Not RAG.** The questions in scope are structured counts/aggregates
("how many X where Y"), not free-text document search. Embedding rows
for semantic retrieval doesn't compute a count correctly. RAG would
only become relevant later if the assistant also needs to answer over
free-text content (case notes, written reports) -- out of scope for v1.

**Not raw text-to-SQL.** Letting the model generate literal SQL needs a
direct Postgres connection (Supabase's JS client can't execute raw SQL)
plus real SQL-parsing validation to be safe. Given this is foster-care
data, that's more risk than the flexibility is worth right now.

**Chosen: tool-calling with structured query params.** Claude picks a
generic tool shape (`table`, `filters`, `aggregation`, `group_by`) from
a curated schema doc. The Node backend validates the table/column names
against a hard-coded allowlist, builds the actual query with the
Supabase JS client (`@supabase/supabase-js`), which goes through
PostgREST/RLS exactly like every other request this backend already
makes -- no raw SQL ever gets generated or executed. This reuses the
JWT-forwarding + RLS pattern already mandated in this repo's `CLAUDE.md`
("Authorization model: RLS + JWT-forwarding, not JWT-verify-then-bypass").

Flow per question (2 Claude API calls):

1. Admin asks question in web UI -> POST to backend with admin's auth
   session (agency_id comes from the verified JWT, never from the
   client or from the model).
2. Backend calls Claude with the question + curated schema doc + the
   generic query tool definition.
3. Claude replies with a tool call (`table`, `filters`, `aggregation`).
4. Backend validates: table/column in the allowlist, forces
   `agency_id` filter itself, rejects anything not a read.
5. Backend executes via the forwarded-JWT Supabase client, gets rows.
6. Backend sends the result back to Claude in a second call; Claude
   phrases the natural-language answer (+ any stat/table data the UI
   renders as a mini report, per the mockup).
7. Answer + raw data returned to the web UI.
8. Every question + which table/aggregation matched (or "no match") is
   logged -- this is the roadmap for which real gaps to fill next,
   without guessing upfront.

## 3. Data scope (curated schema doc -- current, post-launch)

The Supabase project has ~120 tables in `public`; most (billing,
impersonation, GDPR audit, platform internals) are irrelevant to admin
reporting questions and must **not** appear in the schema doc or the
allowlist. This is the single source of truth in code:
`figapp-backend/src/services/admin-chat/schema-catalog.ts`
(`ADMIN_CHAT_TABLES`) -- this section is a snapshot of it, kept roughly in
sync, not authoritative on its own.

**Two corrections found after the original draft:** `households` and
`placements` are both dead tables (0 rows) -- the app actually uses
`carer_households` and `household_children`/`household_carers`. Always
verify real row counts/usage before trusting a table name that sounds
right.

Several tables that matter for real questions (household composition,
event participants) don't have a direct `agency_id` column, which broke
the "always force agency_id" rule from section 4. Rather than teaching the
query tool to do joins (reopening the SQL-injection-shaped risk this whole
design avoids), each of those is exposed as a Postgres **view** --
`admin_chat_<name>_named` -- that pre-joins in `agency_id` and human-readable
names, created `with (security_invoker = true)` so RLS on every joined
table is still enforced as the calling admin, not the view owner. Adding
a table means adding one catalog entry when it already has `agency_id`, or
one reviewed view + one catalog entry when it doesn't.

| Table / view | Purpose |
|---|---|
| `agency_users` | agency staff, social workers, foster carers |
| `carer_households` | foster carer households |
| `admin_chat_daily_log_assignments_named` (view) | daily log tasks, with the real "who this is for" name (child, or the placed parent for a `placed_parent`-subject row) already joined in -- the raw `daily_log_assignments` table only has UUIDs |
| `daily_log_answers` | per-question answers inside submitted daily logs |
| `events` | calendar events |
| `admin_chat_event_participants_named` (view) | who's invited/attending an event + RSVP status, with names joined in |
| `documents` | document records (signature/status) |
| `tickets` | support tickets |
| `surveys`, `survey_responses` | survey distribution + responses |
| `expense_claims` | expense claim status |
| `admin_chat_household_children_named` (view) | which children are placed in which household, with names joined in |
| `admin_chat_household_carers_named` (view) | which carers belong to which household, with names joined in |

Every filterable status/role/type-like column also has a `columnValues`
entry in the catalog listing its real values (pulled from actual DB data
and Postgres enum definitions) -- without this, Claude guesses
plausible-sounding values (`"overdue"`, `"pending"` for expense claims)
that don't exist, silently matching zero rows and then, uncorrected,
misreporting that as a positive result. See `claude-client.ts`'s
`COMPOSE_SYSTEM_PROMPT` for the explicit instruction against that failure
mode.

Adding a table later = adding one entry to the schema doc + the
allowlist, not a code change to the query builder.

## 4. Guardrails (must-haves, not nice-to-haves)

Given this is foster-care/child-safeguarding data:

- **Never trust `agency_id` from the model or the client.** Always take
  it from the caller's verified JWT (`supabase.auth.getUser(token)`),
  per this repo's existing security pattern, and inject it into every
  query server-side.
- **Table/column allowlist enforced in code**, matching section 3 --
  not just "the model was told which tables exist."
- **Read-only.** The generic query tool can only express `SELECT`-shaped
  operations (filter + aggregate); there is no write path for it to
  reach.
- **Log every question**, matched table/aggregation (or none), and the
  final answer, for audit and for finding real coverage gaps.
- **No answer if no safe match.** If the question doesn't map to an
  allowlisted table, the assistant says so rather than guessing.

## 5. Rate limiting (keep budget tight)

Two layers:

1. **App-level daily cap per admin** (e.g. 30-50 questions/admin/day,
   exact number TBD -- see open questions). Enforced in the Node
   endpoint before calling Claude at all. Reuse the existing
   `usage_tracking` table (currently 0 rows in the `public` schema) as
   the counter store rather than adding a new table.
2. **Hard monthly spend cap at the Anthropic Console level** (API
   key/workspace spend limit) as an absolute ceiling independent of
   app logic -- protects against a bug (retry loop, runaway usage)
   that the app-level cap fails to catch.

## 6. Budget

### Current Claude API pricing (per 1M tokens)

| Model | Input | Output |
|---|---|---|
| Haiku 4.5 | $1.00 | $5.00 |
| Sonnet 5 | $2.00 | $10.00 |
| Opus 5 | $5.00 | $25.00 |

Cached input tokens (the curated schema doc + tool definitions, reused
across both calls per question and across questions) cost roughly 90%
less than fresh input -- worth adding once real usage exists; not
needed for the v1 build.

### Estimated running cost (assumes ~4,000 input + ~250 output tokens
per question across both calls combined)

| Volume | Sonnet 5 | Opus 5 |
|---|---|---|
| ~300 questions/month (current, 1 agency) | ~$3/month | ~$8/month |
| ~1,000 questions/month (multi-agency growth) | ~$10/month | ~$26/month |

At current single-agency scale this is a "don't worry about it" cost.
The app-level daily cap (section 5) is what actually keeps this bounded
as agencies/admins grow, not model choice.

### Estimated build effort (solo dev)

| Task | Estimate |
|---|---|
| Curated schema doc (this doc's section 3, formalized for the prompt) | 0.5 day |
| Safe query layer (tool schema + Node validation + agency_id enforcement) | 1.5 days |
| Node backend endpoint (2 Claude API calls, logging, daily rate limit) | 1 day |
| Chat UI in the web admin app (real version of the mockup) | 1.5-2 days |
| Testing across all tables + safety/edge cases | 1 day |
| Buffer for iteration once real questions come in | 1 day |
| **Total** | **~6.5-7.5 days (~1.5-2 weeks part-time)** |

No new infra spend: reuses existing Supabase (RLS already enabled on
every table involved) and existing hosting.

## 7. Build order

1. Write the curated schema doc (section 3) in prompt-ready form.
2. Build the generic query tool schema + Node-side allowlist validator.
3. Add the Node endpoint (question in, 2 Claude calls, validated
   Supabase query, logging, daily rate-limit check against
   `usage_tracking`).
4. Set the Anthropic Console monthly spend cap.
5. Build the chat UI in `figapp-new` (web admin), matching the approved
   mockup.
6. Test against every table in section 3 + confirm cross-agency
   isolation (an admin from Agency A cannot get Agency B's numbers).
7. Ship to the one live agency, watch the question log, expand the
   schema doc based on real gaps rather than guessing more upfront.

## 8. Open questions (need a decision before/while building)

- **Which repo hosts the query endpoint?** This repo's `CLAUDE.md`
  currently scopes figapp-backend to *mobile app only* (foster_carer
  role); the admin chat is a web-admin (agency admin role) feature. The
  web app's other business logic currently lives in Supabase Edge
  Functions. Options: (a) extend figapp-backend's scope to cover this
  admin endpoint too, accepting the mobile-only framing in `CLAUDE.md`
  needs updating; (b) build it as a new Supabase Edge Function,
  matching the web app's current pattern; (c) build it inside
  `figapp-new` itself if that repo has its own server-side API layer.
  Not decided yet -- flagging here so it's a conscious choice, not a
  default.
- **Exact daily question cap per admin** (section 5) -- pick a number
  once there's a sense of real usage, or set a conservative default
  (e.g. 40/day) and adjust.
- **Model choice for v1** -- Sonnet 5 is the suggested default
  (cost/quality balance); Opus 5 available if answer quality on
  ambiguous questions needs it.
