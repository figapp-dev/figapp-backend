# ADR: Daily Log Question Catalog

Status: approved -- code-file-backed
Repos affected: figapp-backend (new, canonical), figapp-flutter, figapp-new

**Revision note:** this ADR went through three shapes before landing here.
V1: a hand-authored TypeScript file. V2: a table-backed design, to support
a future admin panel with CRUD editing and an audit trail. V3 (this
version): back to the file, after weighing it directly against tables --
the developer's actual priority is staying in the Cursor + git workflow
already used for this project, not building an admin panel. Decided
explicitly, not defaulted into. If an admin panel becomes a real
requirement later, section 4's schema is what V2 already designed for it,
and can be revisited then; nothing here blocks that later.

## 1. Problem

This is the second attempt at restructuring the Daily Log feature. The
developer's own diagnosis, which this design is built around:

1. A single wording change requires editing multiple separate places, and
   it is easy to miss one.
2. Editing the current source of truth (a JSONB blob in Supabase) is
   difficult and error-prone.
3. This produces confusion about whether a change is actually complete.

### Confirmed root causes

- **Duplication.** Question wording, field visibility, repeatable sub-item
  wording, and AI-suggestion matching are each hand-implemented twice --
  once in Dart (`figapp-flutter`), once in TypeScript (`figapp-new`) --
  roughly 750 lines each for wording alone.
- **Fuzzy substring matching causes real, silent collisions.** Confirmed
  live during this project: rewording `return_home_not_return_details` to
  start with "Why didn't..." caused it to accidentally match an unrelated
  `label.contains("why didn't")` check in `proactive_suggestions.dart`,
  silently hijacking its AI suggestions. Not predictable from reading the
  spec; only caught because a test happened to cover it.
- **Supabase JSONB is a poor authoring experience** for prose -- no diffs,
  no PR review, no type-checking, requires a SQL migration for a wording
  tweak.

### Already solved, unaffected by this ADR

Reporting: `daily_log_answers` (Supabase table + trigger populated from
`daily_logs.data_json`) is already built, tested, and live -- one row per
question/answer, multiselect answers already exploded into one row per
selected option. Confirmed this already satisfies "reports for each
question and answer." No new reporting table is part of this ADR.

## 2. Current architecture (what exists today)

`daily_log_templates.template_fields` (Supabase JSONB) defines each field's
`id`, `type`, `label`, `options`, `required`, grouped into sections. This
is the only thing genuinely shared between platforms today.

Both apps independently hand-implement behavior on top of that raw data:

| Concern | Flutter | Web |
|---|---|---|
| Question wording | `question_phrasing.dart` | `dailyLogQuestionPhrasing.ts` |
| Field visibility | `field_visibility.dart` | `useDailyLogFieldVisibility.ts` |
| Repeatable sub-item wording | hardcoded in `daily_log_repeatable_field.dart` | hardcoded in its web equivalent |
| AI suggestion matching | `proactive_suggestions.dart` | web equivalent |

`figapp-backend/src/lib/daily-log-validation.ts` already exists and is a
mature, production-quality implementation of server-side submit-time
required-field validation, cross-referenced against both apps' own
required-field logic, with its own passing test suite. It already
correctly handles: school-section disabling by education arrangement,
code-level conditional required fields (return-home late/not-returned,
allowance follow-ups), repeatable-row completeness per group
(`ROW_REQUIRED_FIELDS`), incidents (which have **no** `meta.group` tagging
in the template at all -- confirmed against production data, uses a
synthetic array key `incident_items` instead), and mood-comments-required-
when-Other (`MOOD_OTHER_OPTION = "Other (Please Describe in the Comment
Box below)"`).

**This file is explicitly out of scope for this work.** It stays exactly
as it is through every phase below -- see section 11.

Note for later, not now: `MOOD_OTHER_OPTION` above is hardcoded to the
pre-DL-30 casing. When the wording spec's answer-option relabel work
eventually changes that string's casing, this constant needs updating too,
or the check silently stops matching. Tracked in section 16.

## 3. Decision

Split into two layers.

**Layer 1 -- structure, stays in Supabase (`daily_log_templates.template_fields`),
unchanged.** Only: which fields exist, type, options, required-ness,
section grouping. Nothing here is touched or migrated.

**Layer 2 -- behavior, new, authored as TypeScript in `figapp-backend`
("the catalog").** Real git history, PR review, type-checking, Vitest --
matching this repo's existing "production-quality, not MVP" bar. Every
question's wording (including conditional variants), visibility rule, and
AI-suggestion hints, keyed **only** by field `id` -- never by label text.

## 4. Schema

```typescript
// -- Conditions --
export type FieldCondition =
  | { field: string; equals: string }
  | { field: string; in: string[] }
  | { field: string; notIn: string[] }
  | { field: string; answered: boolean }
  | { context: string; equals: string }
  | { context: string; in: string[] }
  | { context: string; notIn: string[] }
  | { all: FieldCondition[] }   // AND
  | { any: FieldCondition[] };  // OR

// -- Questions: default + ordered variants, first match wins --
export type QuestionVariant = { when: FieldCondition; text: string };
export type Question = { default: string; variants?: QuestionVariant[] };

// -- Suggestions: SAME shape as Question. Every variant REQUIRES `when`,
//    enforced by validate.ts (section 10) -- an earlier draft let a
//    no-`when` variant match first and silently kill every variant after
//    it; this shape makes that bug impossible to write.
export type SuggestionVariant = { when: FieldCondition; phrases: string[] };
export type SuggestionSet = { default: string[]; variants?: SuggestionVariant[] };

export type CatalogEntry = {
  fieldId: string;
  question: Question;
  visibleWhen?: FieldCondition;       // absent = always visible
  suggestions?: SuggestionSet;
  reportingKey?: string;              // for daily_log_answers grouping across e.g. arrangement sets
  repeatableFields?: CatalogEntry[];  // appointments/medications/contacts/incidents sub-questions
};

// -- The document served to both apps --
export type CatalogDocument = {
  schemaVersion: number;   // structural shape -- bump when the TYPE shape changes
  catalogVersion: number;  // content revision -- bump by hand on every wording/rule change
  fields: Record<string, CatalogEntry>;
};
```

**Built and unaffected by anything in this ADR's history:**
`figapp-backend/src/daily-log-catalog/types.ts` (this schema exactly),
`resolve.ts` (the interpreter, section 6), `versioning.ts` (section 9),
and the seven-case fixture (section 10) -- all already written, type-check
clean, all tests passing.

A field like "comments" existing under appointments, medications, and
contacts is not a naming collision here the way it would be in a flat
database table -- each is its own `CatalogEntry` nested inside its own
parent's `repeatableFields` array, so there's nothing to key uniquely
across parents in the first place. (This was a real problem in the
table-backed V2 of this ADR, which needed a composite
`(parent_field_id, field_id)` key to solve it -- moot here, since nesting
already scopes each one correctly.)

### Substitution tokens

`{they}`, `{possessive}`, `{wasWere}` for top-level questions, plus
row-scoped `{who}`/`{type}` for repeatable items.

Authoring rule: write `Why {wasWere} {they} late?`, not `Why was {they}
late?` -- the verb token alone still leaves "they" in the sentence when a
real name should be substituted, producing "Why was they late?".

## 5. Worked examples

```typescript
// Meal follow-up: wording changes on the sibling's answer, hidden entirely on Unknown
{
  fieldId: "breakfast_details",
  question: {
    default: "What did {they} have for breakfast?",
    variants: [{ when: { field: "breakfast", equals: "No" },
                 text: "Why didn't {they} have breakfast this morning?" }]
  },
  visibleWhen: { field: "breakfast", in: ["Yes", "No"] }   // Unknown -> never shown
}

// School attendance chain: compound condition, external (profile) context
{
  fieldId: "reason_for_lateness",
  question: { default: "Why {wasWere} {they} late for school?" },
  visibleWhen: { all: [
    { field: "attended_school", equals: "Yes" },
    { field: "attended_on_time", equals: "No" }
  ]}
}

// "Still has school" gate -- denylist, not allowlist (see section 6)
{
  fieldId: "attended_school",
  question: { default: "Did {they} attend school today?" },
  visibleWhen: { context: "educationArrangement",
                 notIn: ["early_years", "sixteen_plus", "employment_training"] }
}

// Repeatable group: appointments' own "comments" sub-question. A sibling
// entry for medications or contacts would each have their OWN "comments"
// CatalogEntry, nested under their own parent -- no collision, see section 4.
{
  fieldId: "appointments",
  repeatableFields: [{
    fieldId: "comments",
    question: { default: "Would you like to add anything about this appointment?" },
    suggestions: {
      default: [],
      variants: [{ when: { field: "type", equals: "Dentist" },
                   phrases: ["No issues found", "Follow-up in 6 months"] }]
    }
  }]
}
```

## 6. Interpreter contract

Identical logic, implemented once in Dart, once in TypeScript (~30 lines
each). **Already built** (`resolve.ts`, figapp-backend). This is what
actually collapses the duplication: not zero copies (Dart and TypeScript
cannot literally share code), but one tiny generic function per platform
instead of dozens of hand-written, fuzzy-matched branches.

```
resolveVisible(entry, scope):
  visibleWhen absent -> true; else evaluate(visibleWhen, scope)

resolveQuestion(entry, scope, tokens):
  for variant in entry.question.variants (in order):
    if evaluate(variant.when, scope) -> substitute(variant.text, tokens)
  return substitute(entry.question.default, tokens)

resolveSuggestions(entry, scope, tokens):
  for variant in entry.suggestions.variants (in order):
    if evaluate(variant.when, scope) -> variant.phrases (substituted)
  return entry.suggestions.default (substituted)

evaluate(condition, scope):
  all/any -> recurse and combine
  value = condition.field ? scope.answers[condition.field] : scope.context[condition.context]
  equals/in  -> exact string match against value, NEVER substring
  notIn      -> true if value is null/unset, OR value is a string not in the list
  answered   -> string: non-empty after trim; array (multiselect): non-empty; else: not null/undefined
```

Two correctness rules that must not be violated by any future edit to this
function:

- **`equals`/`in`/`notIn` are exact string comparisons, always.** Never
  `.contains()`. Reintroducing substring matching anywhere in this
  interpreter recreates the exact bug class this ADR exists to eliminate.
- **`notIn`, not an allowlist, for "is this arrangement one that still has
  school."** An allowlist (`in: [...]`) hides school questions when the
  arrangement is empty/unset. The documented, current fallback is "no
  arrangement set -> still show Formal Schooling." `notIn` naturally
  preserves that: `null` is never "in" a denylist, so an unset arrangement
  stays visible. This condition is transitional -- once the Education
  section rebuild (Phase D, out of this ADR's scope) lands, each
  arrangement gets its own field ids and this specific condition goes away.

### Repeatable row scope

`mergeRowScope(parentAnswers, rowAnswers)` -- **built.** Inside a
`repeatableFields` entry, `scope.answers` is the current row's fields
merged over the parent log's answers (row values take precedence).
`{field: "type", equals: "Dentist"}` inside an appointment's sub-question
resolves against that row's own `type`, not a nonexistent top-level field.

### Arrangement canonicalization

Raw profile values (e.g. `"Not yet school age"`, `"16+ (in work/trade)"`,
`"16+ (in education)"`, `"Home Learning/Tuitions"`) are normalized **once**,
before any condition ever runs, into one of: `formal_schooling |
home_learning | early_years | sixteen_plus | employment_training | null`.

This is a **new** normalizer, not the existing `LEGACY_TO_CANONICAL_ARRANGEMENT`
map in `daily-log-validation.ts` -- that map only renames two display-string
variants to other display strings (`"Home Learning/Tuitions"` ->
`"Home Learning / Tuition"`, `"16+ (in work/trade)"` -> `"16+ Education,
Employment or Training"`); it was never meant to, and does not, produce
short canonical ids, and stays exactly as it is. `resolve.ts` and its tests
never see a raw profile string at all -- they only ever receive an
already-canonical id via `context.educationArrangement`. The
raw-string-to-canonical-id mapping function is written when the
school/education catalog fields themselves are authored (Phase A step 2,
catalog content), not as part of the interpreter in step 1, and is not
part of the shared resolve fixture (section 10).

## 7. Ordering

The catalog is a lookup, never an ordering authority. Top-level question
order always comes from the template (Supabase), in template order.
Repeatable sub-question order stays whatever `daily_log_repeatable_field.dart`
(and its web equivalent) already render -- only the hardcoded strings
inside that widget move to the catalog. The widget itself is not deleted.

## 8. The mechanism that replaces every allowlist and the fallback tier

**Askable fields = template ids intersected with catalog ids, in template
order.**

- A template field with no catalog entry is never asked -- replaces
  today's hardcoded evening-section allowlist (`_eveningUiFieldIds`) with
  no extra mechanism.
- A catalog entry whose id is not present in a given agency's template is
  skipped.
- **No fallback to label-based pattern matching, for any unmatched field,
  ever.** An earlier draft of this plan kept a "narrow generic fallback
  tier" for unknown fields -- that was wrong to keep, since that fallback
  tier is exactly where the fuzzy substring matching lives today.
- A template field added later will not appear until it has a catalog
  entry. `validate.ts` **reports** (does not fail the build on) template
  fields with no catalog entry -- omission is sometimes intentional, so
  this is a reviewable diagnostic, not a hard error.

**One documented exception: `incident_items`.** Discovered while authoring
the catalog content (Phase A step 2): the real template's own incidents
fields (`incidents_details`, `incident_type`, `incident_report_status`,
`incident_attachments`) are already dead in the current app --
`chat_question_order.dart`'s `_incidentsOrdered()` silently drops all four
and substitutes a synthetic, template-less field
(`_syntheticIncidentItems`, id `incident_items`) that actually drives the
repeatable add-incident sheet. Decided explicitly (not defaulted into):
the catalog carries that same id, `incident_items`, as **one** deliberate,
tracked exception to the template-intersection rule, preserving today's
real behavior instead of leaving it as an undocumented code-only
substitution. The four dead template fields are not given catalog entries
-- they are unreachable today, and authoring them would misrepresent, not
port, current behavior. If the template itself is ever cleaned up to
remove those four dead fields (a separate, independent decision -- not
made here), `incident_items` stops being an exception and becomes an
ordinary catalog id with no backing template field to intersect against,
same as any other orphaned entry.

## 9. Distribution and caching

- `figapp-backend` exposes `GET /daily-log-catalog` -- **one global,
  unresolved document**, `{they}` etc. still literal in the strings. Must
  **not** be embedded in `GET /daily-logs/:id` -- a per-log response with
  one child's name already substituted in cannot be reused for the next
  child, and defeats caching entirely.
- **Runtime fetch is primary.** Both apps call this endpoint and cache the
  result -- Flutter in drift/sqflite (matching its existing offline
  pattern), web in **localStorage** (a session cache is empty the next
  time an offline tab reopens).
- **Bundled fallback, for true first-launch-with-zero-connectivity only.**
  A script exports the catalog to a static JSON file, committed into both
  `figapp-flutter` and `figapp-new`, regenerated whenever the catalog
  changes.
- **Reconciliation rule (built, `versioning.ts`):** use a fetched copy only
  if its `schemaVersion` matches what this app binary understands; between
  the fetched copy and the bundled seed, use whichever has the higher
  `catalogVersion`.
- **`catalogVersion` is bumped by hand**, as part of the same PR that
  changes `catalog.ts` -- a normal, small habit (like a package version
  bump), not automated. `schemaVersion` changes only when the TypeScript
  shape itself changes, which is a code release, not a content edit.
- **Submit-time validation is not changed by this ADR.**
  `validateDailyLogSubmit` (section 11, untouched) remains the sole
  required-field authority -- it already encodes real conditional
  required-ness independently of the catalog. The catalog's
  `resolveVisible` is deliberately **not** re-run server-side as a
  submit-time reject gate: the wizard does not strip a field's key out of
  `dataJson` the moment it becomes hidden (a follow-up can be left holding
  a stale/empty value from before the toggle last changed), so a
  presence-based visibility check on submit would reject perfectly normal
  logs. A hidden field must never fail submit -- handled simply by never
  asking `validateDailyLogSubmit` to require it, which it already does
  correctly today. See the worked example in section 15, step 6.

Practical payoff: because Flutter and web fetch data rather than compile it
in, a pure wording change is a **backend-only deploy** -- no App Store /
Play Store review cycle required for text-only changes.

## 10. Anti-drift tooling (mandatory, not optional)

`validate.ts` fails the build when:
- a field id is duplicated,
- a `when.field` references an id that is neither a top-level catalog
  field id nor, for a condition inside a `repeatableFields` entry, a key
  present in that same repeatable group's row data (e.g. `type` inside
  `appointments` -- a template row key with no separate top-level catalog
  entry of its own, exactly as used in the worked example in section 5),
- a `context` condition's value is not one of the canonical arrangement
  ids,
- a suggestion variant is missing `when`.

**One shared fixture** of resolve-test-cases runs in both the Vitest suite
(figapp-backend) and the Flutter test suite -- the two independently
hand-written interpreters are checked against identical inputs/outputs on
every CI run, so they cannot silently drift apart. **Already built and
passing** (`tests/daily-log-catalog/resolve.test.ts`, 7/7):

1. Null/unset arrangement with a `notIn` condition -> field stays visible
   (the "still has school" case).
2. Home learning arrangement -> correct wording variant selected.
3. Early years arrangement -> field correctly hidden.
4. A suggestion variant match (not just the default list).
5. A repeatable row where `type: "Dentist"` -> row-scoped condition
   resolves correctly against the row, not the parent log (asserted both
   ways: matches when merged, fails to match on parent-only scope).
6. A `schemaVersion` the consuming app does not understand -> rejected,
   falls back to the bundled seed.
7. A fetched catalog with a higher `catalogVersion` than the bundled seed
   wins (and the reverse).

Porting this same fixture to Flutter is Phase B work, not yet done.

## 11. What stays exactly as-is (explicit scope boundary)

- `src/lib/daily-log-validation.ts` (backend) -- unchanged through every
  phase below.
- `required_fields.dart` (Flutter) and its web equivalent -- unchanged.
  Conditional required-ness (e.g. "mood comments required only when Other
  is selected") is real logic beyond `visibility + template.required`, and
  redesigning it into the catalog is explicitly out of scope for this ADR.
- `daily_log_repeatable_field.dart` and `repeatable_items.dart` (and web
  equivalents) -- the add-appointment UI and row-parsing logic stay. Only
  their hardcoded question/comment strings move into the catalog.
- `daily_log_answers` reporting table -- already built, unaffected.
- Answer-option relabels (DL-16-22/30/38-40 from the wording spec) --
  direct structural template edits in Supabase, independent of this work.
- **No deletion of old tables or files as part of Phases A-C.** The catalog
  is additive; nothing here removes existing storage or existing logs.
  Cleanup of superseded files happens later, at the developer's own
  discretion, once both apps are proven to be reading from the catalog.

## 12. File layout

```
figapp-backend/src/daily-log-catalog/
  types.ts        -- BUILT (section 4)
  resolve.ts       -- BUILT (section 6)
  versioning.ts    -- BUILT (section 9)
  validate.ts       -- NOT BUILT (section 10)
  catalog.ts        -- NOT BUILT: the authored content itself
  export-fallback.ts -- NOT BUILT: regenerates the bundled JSON for both apps
figapp-backend/tests/daily-log-catalog/
  resolve.test.ts    -- BUILT, 7/7 passing (section 10)
  catalog.test.ts     -- NOT BUILT: validate.ts assertions against the real authored catalog
figapp-backend/src/routes/
  daily-log-catalog.ts -- NOT BUILT: GET /daily-log-catalog

figapp-flutter/lib/features/daily_logs/domain/catalog/
  catalog_models.dart      -- NOT BUILT
  catalog_resolver.dart     -- NOT BUILT: port of resolve.ts + the same 7-case fixture
  catalog_repository.dart    -- NOT BUILT: fetch + drift cache + bundled fallback
figapp-flutter/assets/daily_log_catalog_fallback.json -- NOT BUILT
figapp-flutter/test/features/daily_logs/catalog/
  catalog_resolver_test.dart -- NOT BUILT

figapp-new/src/daily-logs/catalog/
  catalogResolver.ts    -- NOT BUILT (may literally share code with resolve.ts, bonus not required)
  useDailyLogCatalog.ts  -- NOT BUILT: fetch + localStorage cache + bundled fallback
figapp-new/public/daily-log-catalog-fallback.json -- NOT BUILT
```

## 13. Rollout sequence, with hard gates

**Phase A -- build, unwired.**
1. `types.ts` + `resolve.ts` + `versioning.ts`, unit-tested against the
   7-case shared fixture. **Done.**
2. Author the real catalog content for Sections 1, 3-7 (not Section 2 yet)
   using the wording spec's already-approved text -- matches what is
   already correctly implemented in Flutter today. Write the new
   arrangement normalizer alongside the school fields here, not in step 1.
   **Not started.**
3. `validate.ts` passing against the real authored catalog. `GET
   /daily-log-catalog` endpoint live, tested. **Not started.**

**Phase B -- Flutter reads from the catalog, proven, old code deleted.**
4. `catalog_resolver.dart` / `catalog_repository.dart` (fetch, drift cache,
   bundled fallback).
5. Wizard and form screens call the new resolver instead of
   `question_phrasing.dart` / `field_visibility.dart`.
6. Full existing test suite green. **Gate: parity against current Flutter
   behavior** -- correct check here, since Flutter already has the approved
   wording.
7. Only once that gate passes: delete `question_phrasing.dart`,
   `field_visibility.dart`, and the hardcoded strings (not the widget
   itself) inside `daily_log_repeatable_field.dart`.

**Phase C -- same for web, different gate.**
8-11. Mirror steps 4-7 for `figapp-new`. **Gate is not parity against
web's current output** -- web still has stale, pre-spec wording today. The
correct check: web-via-catalog produces the same approved wording Flutter
already shows.

**Hard stop: do not proceed past this point until both platforms are
proven on the catalog with their old files deleted.**

**Phase D -- only now, the Education section rebuild** (separate piece of
work, not detailed in this ADR): author ED-A through ED-E directly as
catalog entries from the start.

Explicitly **not** part of this sequence: `daily_log_answers` reporting
(done, confirmed sufficient); answer-option relabels (independent Supabase
template edits, any time).

## 14. Draft persistence, background sync, and cross-device freshness

Orthogonal to the catalog itself (the catalog only resolves question text
and visibility -- it has no opinion on save cadence), but directly relevant
to how a question actually gets answered and reaches the database.

### What already exists (confirmed against the real code, not assumed)

Two tiers, not one:

1. **Instant local write, every answer, no network.** Flutter's wizard
   `_goNext()` always calls `_flushLocalQuietly()`, which writes straight to
   the drift table `daily_log_drafts` via `DailyLogsLocalDatasource.upsertDraft()`
   -- synchronous, on-device, unconditional. Tapping "Next" never waits on
   the network, online or offline.
2. **Opportunistic network sync**, separate from #1: `PUT /daily-logs/:id`
   with `intent: "save"` (`daily-logs.ts`) -- explicitly allows partial
   `dataJson` and skips `validateDailyLogSubmit` entirely (only
   `intent: "submit"` runs that check). Today this fires only at wizard
   close (`_close()`, best-effort, non-blocking -- the code comment there
   notes this is the *only* thing that pushes a `pendingSync` draft to the
   server mid-session) and from `DailyLogSyncHost.flushPending()` on app
   start / resume / reconnect.

Resuming mid-fill on the *same* device already works regardless of whether
that background sync has run yet: `mergeLocalDraftData()` always overlays
local answers over the last-fetched remote copy, pending-sync or not.

### Decision: push after every answered question too -- not part of Phase A

**Status: decided, not yet built.** Explicitly out of the Phase A
implementation pass (section 13). Recorded here so the correct version
gets built when this is picked up.

**Motivation, stated precisely by the developer:** not literal real-time --
cross-device freshness. If a co-carer opens the same in-progress log on a
second phone, they should see "as of the last question answered," not
"as of last close/resume/reconnect."

**Change (not `_saveDraft()` reused as-is):** add a single-flight, quiet
background push, called from `_goNext()`, not only from `_close()`. Do not
just call `_saveDraft()` again there: (a) it surfaces a `ScaffoldMessenger`
error SnackBar on failure -- correct for an explicit, user-initiated save,
wrong for a silent per-question background push, and (b) it has no
in-flight guard, so two overlapping calls (fast Next-tapping, or a slow
response overlapping the next question's push) would both carry the same
`expectedUpdatedAt` and the loser gets a `409 CONFLICT` against itself. The
quiet variant needs: skip entirely if a push is already in flight for this
log -- one quiet save at a time is enough, not one per tap -- and no error
UI on failure, relying on `pendingSync` + `flushPending()` exactly like
today. Still never blocks the UI either way.

Not a plain skip, though: if more answers land while a push is in flight,
don't drop them until close. Coalesce -- once the in-flight push completes,
send one trailing push with whatever is latest at that point, if anything
changed during the wait. A carer moving through questions faster than one
round-trip would otherwise leave a second device stuck behind the last
question that happened to win the race.

**What this gives you:** the next `GET /daily-logs/:id` from *any* device
reflects the latest successfully-pushed answers.

**What this does NOT give you:** a screen already open on Device B does not
update live while Device A keeps typing. That needs a Supabase Realtime
subscription on the `daily_logs` row -- the same pattern already used for
FigChat. Deliberately **not** built now. If it ever is, it raises a real
conflict-resolution question that doesn't exist today: the current
`expectedUpdatedAt` optimistic lock simply rejects a second concurrent
writer with `409 CONFLICT` rather than merging field-by-field. Only worth
solving if two carers are shown to actually edit the *same* log
simultaneously often enough to matter.

## 15. Worked end-to-end example: one question through the full stack

Using the meal follow-up example from section 5 (`breakfast_details`:
wording depends on the sibling answer, hidden entirely on "Unknown"),
traced through catalog fetch, render, save, cross-device read, and submit.

**1. Catalog fetch (once per session/launch, both platforms, same call shape)**
```
GET /daily-log-catalog
Authorization: Bearer <user JWT>
```
Response (identical to both apps -- unresolved, `{they}` still literal):
```json
{
  "schemaVersion": 1,
  "catalogVersion": 47,
  "fields": {
    "breakfast_details": {
      "fieldId": "breakfast_details",
      "question": {
        "default": "What did {they} have for breakfast?",
        "variants": [{ "when": { "field": "breakfast", "equals": "No" },
                       "text": "Why didn't {they} have breakfast this morning?" }]
      },
      "visibleWhen": { "field": "breakfast", "in": ["Yes", "No"] }
    }
  }
}
```
Flutter caches it in drift; web in `localStorage`; both reconcile against
their bundled fallback by `catalogVersion` (section 9).

**2. Render -- local resolve, no network call per question**
```dart
final entry = catalog.fields['breakfast_details']!;
if (resolveVisible(entry, scope)) {
  final label = resolveQuestion(entry, scope, tokens); // uses current answers-so-far
}
```

**3. Carer answers "No" to `breakfast`**
- Written to `daily_log_drafts` (drift) instantly, synchronously -- no network.
- Catalog resolver picks the `breakfast` == `"No"` variant, so the very
  next question renders as *"Why didn't Alex have breakfast this
  morning?"* immediately, purely from the locally cached catalog + the
  answer just typed.

**4. Carer taps Next**
- `_flushLocalQuietly()` -- local write, instant, always.
- The single-flight quiet push from section 14 (not `_saveDraft()`
  directly) fires in the background: `PUT /daily-logs/:id?intent=save`
  with `{ "breakfast": "No" }` (partial, unvalidated). Does not block the
  UI, has no error UI, and if a push is already in flight for this log,
  this tap just marks "more landed since" rather than firing a second
  overlapping request -- picked up as one trailing push once the in-flight
  one completes. Silently queues (`pendingSync`) if offline.

**5. Cross-device read**
A co-carer opens the same assignment on a second phone:
```
GET /daily-logs/:id
```
returns `dataJson` including `{"breakfast": "No"}` if step 4's push
succeeded. Their wizard resolves the same catalog entry against that
answer and shows the identical *"Why didn't ... have breakfast"* wording
and the same visibility -- no drift between devices in either the data or
the question shown for it, because both are derived from the same catalog
+ the same stored answer, never from device-local wording logic.

**6. Final submit**
```
PUT /daily-logs/:id
{ "intent": "submit", "dataJson": { "breakfast": "No", "breakfast_details": "Ran out of time", ... },
  "expectedUpdatedAt": "..." }
```
Backend -- unchanged from what exists today:
```typescript
// existing, untouched file -- the sole required-field authority
const requiredIssues = validateDailyLogSubmit(data, templateFields, arrangement);
```
The catalog is not consulted on submit (see section 9 -- a presence-based
visibility reject would fail normal logs, since the wizard can leave a
stale/empty value behind for a field it has since hidden). On success:
`daily_logs` row written, `sync_daily_log_answers()` trigger fires,
`daily_log_answers` populated -- unchanged, already-shipped reporting path.

If `breakfast` had been `"Unknown"`, `breakfast_details` would never have
been rendered on either device (step 2's `resolveVisible` returns false),
so it would never be answered and `validateDailyLogSubmit` never requires
it. If `dataJson` still carries a stale empty value for it from before
`breakfast` last changed, that's harmless and simply ignored.

**7. Editing the wording later**
A wording change to `breakfast_details` is a normal code change: edit
`catalog.ts`, bump `catalogVersion` by one, open a PR, review the diff,
merge, deploy `figapp-backend`. Every device's next catalog fetch picks up
the new `catalogVersion`, refetches, and shows the new wording -- no
Supabase edit, no admin panel, just the same Cursor + git workflow already
used for the rest of this project.

## 16. Open items to watch, not blocking

- `MOOD_OTHER_OPTION`'s hardcoded casing in `daily-log-validation.ts` will
  need a matching update whenever DL-30's relabel lands (section 2, noted
  above).
- Whether `figapp-backend` becomes the daily-log read path for web more
  broadly (beyond just this catalog endpoint) is a larger, separate
  decision already flagged as a possible future direction for this project
  -- not required by this ADR, which only needs web to call one new
  endpoint for the catalog specifically.
- If an admin panel becomes a real future requirement, the table schema
  worked out in this ADR's V2 (composite `(parent_field_id, field_id)` key
  on the entries table, a child table for grouping a suggestion variant's
  phrases, write-time validation in a `service.ts`, and an audit trigger
  that copies `updated_by` rather than trusting `auth.uid()` under a
  service-role connection) is the starting point -- not something to
  redesign from scratch at that point.
