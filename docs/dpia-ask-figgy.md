# DPIA: Ask Figgy (Agency Admin Chat Assistant)

Status: draft -- awaiting client (data controller) sign-off
Companion doc: `docs/adr-agency-admin-chat-assistant.md` (architecture/build decisions)
Prepared: 2026-10-02

## 1. What is this processing activity?

Ask Figgy lets an agency admin type a plain-English question about their
own agency's data (e.g. "how many children are unplaced?") and get a
real answer computed from that agency's live Supabase data. Two calls to
the Anthropic Claude API are involved per question:

1. **Pick call** -- the question text only goes to Claude, which decides
   which allowlisted table/filter answers it. No row data is sent at
   this step.
2. **Compose call** -- the validated query result (actual rows, which
   can include names, ages, statuses) is sent to Claude so it can write
   the final answer sentence.

Up to 6 prior question/answer turns from the same day are replayed in
both calls, so follow-up questions resolve correctly (see "conversation
continuity" in `src/services/admin-chat/index.ts`).

## 2. What personal data is involved?

Scoped strictly to the allowlisted tables in
`src/services/admin-chat/schema-catalog.ts` (see the ADR's section 3 for
the full list). In practice, a "list"-type answer can include:

- Child names, ages, status (`admin_chat_children_placement_status`,
  `admin_chat_household_children_named`)
- Foster carer / social worker / sw_manager names, roles
  (`agency_users`)
- Household composition, event participants, document/ticket/survey
  status tied to named individuals

"Count"-type answers (the majority of questions, e.g. "how many X") never
include row-level data -- only a number -- so no personal data leaves the
server for those.

**This includes children's data**, which is UK GDPR special-category-
adjacent given the care context. Treat this DPIA as covering
special-category-level risk even where a specific field (e.g. a child's
name) isn't itself special category on its own.

## 3. Why is this necessary? (purpose + legal basis)

Purpose: give agency admins a faster way to answer their own routine
operational questions about data they already have full access to via
the existing dashboards -- Ask Figgy doesn't expose anything an admin
couldn't already see by clicking through the app, it just answers
faster.

Legal basis sits with the agency (the data controller) under its
existing basis for processing this data operationally (typically
legitimate interests / contract performance for care management). Ask
Figgy does not introduce a new purpose for the data -- it's a new access
method for an existing, already-lawful purpose.

## 4. Who is the sub-processor, and what protects the data there?

**Anthropic (Claude API)**, added as a new sub-processor for this
specific feature.

- DPA: included automatically in Anthropic's commercial API terms --
  no separate negotiation needed, but confirm this is explicitly listed
  as a sub-processor in FigApp's agreement with its agency customers
  (open item -- see section 7).
- Retention: 30 days by default (organization-level setting, confirmed
  via Anthropic Console on 2026-10-02 -- "On - 30 days"). **Zero Data
  Retention was considered and explicitly declined for now** (client
  decision, 2026-10-02) -- revisit if risk tolerance changes.
- Training: commercial API data (this product) is never used to train
  Anthropic's models.
- Note: as of June 2026, Anthropic retains data for "Covered Models"
  for 30 days for safety review regardless of retention settings --
  functionally the same as the 30-day default already in place here, so
  no additional exposure from this.

## 5. Protections already built in (as of this draft)

- `agency_id` is always taken from the caller's verified JWT, never from
  the model or client input -- an admin can only ever query their own
  agency (`src/services/admin-chat/index.ts`).
- Table/column allowlist enforced in code
  (`src/services/admin-chat/query-validator.ts`) -- Claude cannot query
  outside the curated catalog no matter what it's asked.
- Read-only. No write path exists through this feature.
- Rate-limited (`env.adminChatDailyLimit`, currently 40/admin/day).
- Every question + matched table/aggregation + answer is logged
  (`admin_chat_logs`) for audit and to find real coverage gaps.
- Caller must be an active `agency_admin` -- checked server-side on
  every call.

## 6. Planned but not yet built

- **Pseudonymization** -- replace name-bearing fields with opaque,
  per-request tokens before they reach Claude's compose call; reverse
  the substitution on the returned answer text before showing it to the
  admin. Purely a backend string-substitution step (no cryptography, no
  key management) -- see conversation notes 2026-10-02. Not yet
  implemented. This is the main planned mitigation given ZDR was
  declined.
- Gap knowingly accepted: an admin's own free-text question can contain
  a real name if they type one directly (e.g. "has John Smith's mother
  submitted her forms?"). Not pseudonymized -- would require
  free-text name detection (NER), which is a materially harder problem
  with its own false-negative risk. Accepted as low-frequency,
  low-severity residual risk -- document this explicitly if asked.

## 7. Open items / residual risk to flag to the client

- **`admin_chat_logs` has no retention limit on FigApp's own side.**
  Unlike Anthropic's 30-day auto-delete, every question + answer
  (including any names that appeared in a "list"-type answer) is kept
  indefinitely in FigApp's own Supabase database today. This is
  currently a bigger exposure than the Anthropic side and should be
  decided explicitly: add a retention/cleanup policy, or confirm
  indefinite retention is acceptable and document why.
- Confirm FigApp's existing DPA/privacy policy with agency customers
  already discloses (or is updated to disclose) Anthropic as a
  sub-processor for this feature specifically.
- Formal legal-basis / Article 36 (ICO prior consultation) determination
  is for the client/DPO to make, not FigApp engineering -- flagging
  this draft's facts are the input to that decision, not the decision
  itself.

## 8. Decision log

| Date | Decision | By |
|---|---|---|
| 2026-10-02 | Keep Anthropic's default 30-day retention; do not pursue Zero Data Retention for now | Client (figapp.uk) |
| 2026-10-02 | Build pseudonymization as the primary mitigation instead | Agreed in planning, not yet built |
