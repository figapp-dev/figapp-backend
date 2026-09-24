import { canonicalEducationArrangementId } from "./education-arrangements.js";
import {
  EDUCATION_HANDLED_FIELD_IDS,
  requiredEducationFieldIds,
} from "./education-question-fields.js";

type TemplateFieldMeta = {
  group?: string;
  role?: string;
};

export type TemplateFieldLike = {
  id?: string;
  label?: string;
  required?: boolean;
  isRequired?: boolean;
  validation?: { required?: boolean };
  meta?: TemplateFieldMeta;
};

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isYes(value: unknown): boolean {
  return value === true || norm(value) === "yes";
}

function isLate(value: unknown): boolean {
  const text = norm(value);
  return text.includes("late") && !isDidNotReturn(value);
}

function isDidNotReturn(value: unknown): boolean {
  const text = norm(value);
  return (
    text.includes("did not return") ||
    text.includes("didnt return") ||
    text.includes("didn't return")
  );
}

/** Education field ids that predate the Section 2 rebuild and are real
 * template fields (shared storage between formal_schooling and
 * home_learning, per the ED-A/ED-B field-mapping table) -- everything else
 * requiredEducationFieldIds can return is a wholly-synthetic id with no
 * template presence at all. */
const REAL_TEMPLATE_EDUCATION_FIELD_IDS = new Set([
  "attended_school",
  "attended_on_time",
  "reason_for_absence",
  "reason_for_lateness",
]);

function isSchoolEducationSectionTitle(title: unknown): boolean {
  const t = norm(title);
  return t.includes("school") || t.includes("education");
}

/** Whether this log's own template even has a School/Education-titled
 * section -- test/minimal templates (e.g. an incidents-only fixture) don't,
 * and must not be required to answer Education questions that were never
 * part of their shape. All 3 production templates do. */
function hasSchoolEducationSection(templateFields: unknown): boolean {
  if (!Array.isArray(templateFields)) return false;
  return templateFields.some(
    (section) =>
      section &&
      typeof section === "object" &&
      isSchoolEducationSectionTitle((section as { title?: unknown }).title),
  );
}

/** Same fuzzy id-or-label matching as web's templateUtils.findFieldId. */
function findFieldId(
  fields: TemplateFieldLike[],
  ...needles: string[]
): string | undefined {
  const normNeedles = needles.map((n) => norm(n));
  const field = fields.find((f) => {
    const label = norm((f as { label?: unknown }).label);
    const id = norm(f.id);
    return normNeedles.some((n) => label.includes(n) || id.includes(n));
  });
  return field?.id;
}

/** Web moodOptions.ts: accepts a real array, a JSON-encoded array string, or a lone legacy string. */
function asMoodSelection(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  if (typeof value === "string") {
    const text = value.trim();
    if (!text) return [];
    if (text.startsWith("[")) {
      try {
        const parsed = JSON.parse(text);
        if (Array.isArray(parsed)) {
          return parsed.map((v) => String(v).trim()).filter(Boolean);
        }
      } catch {
        // fall through to treating it as a single plain value
      }
    }
    return [text];
  }
  return [];
}

/** Same required-field-per-row rules as web's collectValidationIssues.ts
 * validateRepeatableGroup / rowInvalid checks (comments is only required
 * for medications, matching repeatableChatSteps.ts's
 * isRepeatableFieldRequired on both web and Flutter). */
const ROW_REQUIRED_FIELDS: Record<string, readonly string[]> = {
  appointments: ["type", "time"],
  medications: ["time", "medication", "dose", "comments"],
  contacts: ["contact_type", "mode", "time", "who_with"],
};

function isRowMissingFields(row: unknown, requiredKeys: readonly string[]): boolean {
  if (!row || typeof row !== "object") return true;
  const record = row as Record<string, unknown>;
  return requiredKeys.some((key) => !String(record[key] ?? "").trim());
}

/** Same key as web's chat/constants.ts INCIDENTS_ARRAY_KEY / Flutter's
 * isIncidentItemsField — incidents don't use the meta.role="items" /
 * meta.group tagging appointments/medications/contacts do (confirmed
 * against production template data: the "incidents" toggle field has no
 * meta.group at all), so this array key is synthetic/hardcoded on both
 * clients rather than resolved from the template, and is mirrored here the
 * same way. */
const INCIDENTS_ARRAY_KEY = "incident_items";
const INCIDENT_ROW_REQUIRED_FIELDS = ["type", "time", "details", "status"] as const;

function isIncidentsFinalCommentsSectionTitle(title: unknown): boolean {
  const t = norm(title);
  return t.includes("incidents") && t.includes("final");
}

/** The "Incidents" toggle field id, resolved the same fuzzy way web's
 * findFieldId(incidentFields, "incidents") does, scoped to the
 * Incidents/final-comments section only (avoids matching an unrelated
 * field elsewhere whose id/label happens to contain "incidents"). */
function resolveIncidentsToggleId(templateFields: unknown): string | undefined {
  if (!Array.isArray(templateFields)) return undefined;
  for (const section of templateFields) {
    if (!section || typeof section !== "object") continue;
    const { title, fields } = section as { title?: unknown; fields?: unknown };
    if (!isIncidentsFinalCommentsSectionTitle(title) || !Array.isArray(fields)) {
      continue;
    }
    return findFieldId(fields as TemplateFieldLike[], "incidents");
  }
  return undefined;
}

const MOOD_FIELD_ID = "mood_of_the_day";
const MOOD_COMMENTS_FIELD_ID = "mood_comments";
const MOOD_OTHER_OPTION = "Other (Please Describe in the Comment Box below)";

function moodSelectionIncludesOther(value: unknown): boolean {
  return asMoodSelection(value).includes(MOOD_OTHER_OPTION);
}

const householdFollowUps = new Set([
  "household_tasks_performed",
  "household_task_comments",
]);

const allowanceFollowUps = new Set([
  "allowance_amount",
  "payment_mode",
  "allowance_comments",
  "allowances_details",
]);

const lateFollowUps = new Set(["time_of_return", "return_home_late_details"]);

const didNotReturnFollowUps = new Set(["return_home_not_return_details"]);

/** Follow-ups the carer is not asked unless the parent answer opens them. */
function isInactiveFollowUp(
  fieldId: string,
  dataJson: Record<string, unknown>,
): boolean {
  if (householdFollowUps.has(fieldId) && !isYes(dataJson.household_tasks)) {
    return true;
  }
  if (allowanceFollowUps.has(fieldId) && !isYes(dataJson.allowances_given)) {
    return true;
  }
  if (lateFollowUps.has(fieldId) && !isLate(dataJson.return_home_status)) {
    return true;
  }
  if (
    didNotReturnFollowUps.has(fieldId) &&
    !isDidNotReturn(dataJson.return_home_status)
  ) {
    return true;
  }
  return false;
}

/** Treats N/A as a valid selected value (matches web). */
export function isValueEmpty(value: unknown): boolean {
  if (value === undefined || value === null) return true;

  if (typeof value === "string") {
    return value.trim() === "";
  }

  if (Array.isArray(value)) return value.length === 0;

  return false;
}

/** End-of-day free-text note — always optional regardless of template `required`. */
export function isOtherCommentsField(
  field: TemplateFieldLike | null | undefined,
): boolean {
  if (!field) return false;
  const text = `${field.id ?? ""} ${field.label ?? ""}`.toLowerCase();
  return text.includes("other comment") || text.includes("other_comments");
}

export function isFieldRequired(field: TemplateFieldLike | null | undefined): boolean {
  if (!field) return false;
  // Matches web templateUtils + Flutter required_fields: carers may leave
  // the final "anything else" note blank even when the template says required.
  if (isOtherCommentsField(field)) return false;
  return (
    field.required === true ||
    field.isRequired === true ||
    field.validation?.required === true
  );
}

/** Flatten section → fields from template_fields JSON. */
export function flattenTemplateFields(
  templateFields: unknown,
): TemplateFieldLike[] {
  if (!Array.isArray(templateFields)) return [];

  const out: TemplateFieldLike[] = [];
  for (const section of templateFields) {
    if (!section || typeof section !== "object") continue;
    const fields = (section as { fields?: unknown }).fields;
    if (!Array.isArray(fields)) continue;
    for (const field of fields) {
      if (!field || typeof field !== "object") continue;
      const id = (field as TemplateFieldLike).id;
      if (typeof id === "string" && id.trim()) {
        out.push(field as TemplateFieldLike);
      }
    }
  }
  return out;
}

export type SubmitValidationResult =
  | { ok: true }
  | { ok: false; missingFieldIds: string[] };

/**
 * Fields that become required purely from a sibling answer, independent of
 * whatever the template's own `required` flag says — confirmed against
 * production template data that none of these are actually marked required
 * there (return_home_late_details / return_home_not_return_details /
 * payment_mode / allowance_comments / allowances_details / reason_for_absence
 * / reason_for_lateness all come back `required: false` or unset). Without
 * this, isFieldRequired(field) alone would silently skip every one of them
 * and submit would accept the log with them empty, even though the chat/form
 * UI (web's collectValidationIssues.ts, Flutter's
 * _codeLevelRequiredFieldIdsInSection) both already block submitting from
 * the client with them empty. Mirrors those two exactly so all three stay in
 * sync — this is the server-side backstop, not just a client nicety.
 */
function codeLevelRequiredFieldIds(
  dataJson: Record<string, unknown>,
  allFieldIds: Set<string>,
): Set<string> {
  const ids = new Set<string>();

  if (isLate(dataJson.return_home_status) && allFieldIds.has("return_home_late_details")) {
    ids.add("return_home_late_details");
  }
  if (
    isDidNotReturn(dataJson.return_home_status) &&
    allFieldIds.has("return_home_not_return_details")
  ) {
    ids.add("return_home_not_return_details");
  }

  if (isYes(dataJson.allowances_given)) {
    for (const id of allowanceFollowUps) {
      if (allFieldIds.has(id)) ids.add(id);
    }
  }

  return ids;
}

/**
 * Submit validation matches the chat/form UI:
 * - every visible required field must be non-empty
 * - meta.role=items: only required when the group's toggle answers Yes
 * - Yes/No follow-ups (allowance amount, chores list, late details, …)
 *   are not required while their parent answer keeps them hidden — but
 *   *are* required once that parent answer opens them, regardless of the
 *   template's own `required` flag (see codeLevelRequiredFieldIds)
 * - School/Education fields are validated by their own dedicated set of
 *   required field ids per canonical arrangement (see
 *   requiredEducationFieldIds in education-question-fields.ts) rather than
 *   through the template — most of the Section 2 rebuild's field ids are
 *   synthetic (not present in template_fields at all), the same "documented
 *   exception" pattern already used for incident_items below
 */
export function validateDailyLogSubmit(
  dataJson: Record<string, unknown>,
  templateFields: unknown,
  educationArrangement?: string | null,
): SubmitValidationResult {
  const allFields = flattenTemplateFields(templateFields);
  const missingFieldIds: string[] = [];

  if (allFields.length === 0) {
    // No template structure — only empty-object guard elsewhere.
    return { ok: true };
  }

  const allFieldIds = new Set(
    allFields
      .map((f) => f.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );
  const codeRequiredIds = codeLevelRequiredFieldIds(dataJson, allFieldIds);

  // Only this log's own template shape decides whether Education questions
  // apply at all -- a minimal/test template without a School/Education
  // section never asked them, so submit must not demand them either. Of the
  // required ids, only the ones reused from real (pre-rebuild) template
  // fields (attended_school/attended_on_time/reason_for_absence/
  // reason_for_lateness) additionally need to actually exist in this
  // template -- an agency that trimmed one of those out never asked it
  // either. The wholly-synthetic ids (home_learning_*/nursery_*/eet_*/
  // learning_development_*) have no template presence by design, so they're
  // always required once their gate applies.
  const arrangementId = canonicalEducationArrangementId(educationArrangement);
  const requiredEducationIds = hasSchoolEducationSection(templateFields)
    ? new Set(
        [...requiredEducationFieldIds(arrangementId, dataJson)].filter(
          (id) => !REAL_TEMPLATE_EDUCATION_FIELD_IDS.has(id) || allFieldIds.has(id),
        ),
      )
    : new Set<string>();

  for (const field of allFields) {
    const fieldId = field.id;
    if (!fieldId) continue;
    // Handled below via requiredEducationIds instead — real template fields
    // reused across arrangements (attended_on_time, reason_for_lateness, …)
    // must not also be checked here with the wrong (template-order) gating.
    if (EDUCATION_HANDLED_FIELD_IDS.has(fieldId)) continue;

    const role = field.meta?.role;
    const group = field.meta?.group;

    if (role === "items" && group) {
      const toggle = allFields.find(
        (f) => f.meta?.group === group && f.meta?.role === "toggle",
      );
      const toggleVal = toggle?.id != null ? dataJson[toggle.id] : undefined;
      if (!isYes(toggleVal)) continue;

      const rows = Array.isArray(dataJson[fieldId]) ? dataJson[fieldId] : [];
      const requiredRowFields = ROW_REQUIRED_FIELDS[group];
      // Web additionally requires every row to have its own required
      // sub-fields filled (e.g. an appointment needs both a type and a
      // time, not just "an appointment exists") — matches
      // validateRepeatableGroup's rowInvalid checks. Previously only the
      // array-non-empty case below was checked, so a row with an empty
      // type/time could be submitted from mobile even though web blocks it.
      const hasIncompleteRow =
        requiredRowFields != null &&
        (rows as unknown[]).some((row) => isRowMissingFields(row, requiredRowFields));

      if (isValueEmpty(dataJson[fieldId]) || hasIncompleteRow) {
        missingFieldIds.push(fieldId);
      }
      continue;
    }

    if (!isFieldRequired(field) && !codeRequiredIds.has(fieldId)) continue;
    if (isInactiveFollowUp(fieldId, dataJson)) continue;

    if (isValueEmpty(dataJson[fieldId])) {
      missingFieldIds.push(fieldId);
    }
  }

  for (const fieldId of requiredEducationIds) {
    if (isValueEmpty(dataJson[fieldId]) && !missingFieldIds.includes(fieldId)) {
      missingFieldIds.push(fieldId);
    }
  }

  // Mood comments aren't marked required in the template, but become
  // required once "Other" is one of the mood selections — matches
  // collectValidationIssues.ts on web.
  if (
    moodSelectionIncludesOther(dataJson[MOOD_FIELD_ID]) &&
    isValueEmpty(dataJson[MOOD_COMMENTS_FIELD_ID]) &&
    !missingFieldIds.includes(MOOD_COMMENTS_FIELD_ID)
  ) {
    missingFieldIds.push(MOOD_COMMENTS_FIELD_ID);
  }

  // Incidents have no meta.role="items" tagging in the template (confirmed
  // against production data), so they're entirely invisible to the loop
  // above — this was a real gap: with the toggle answered "Yes", mobile
  // could submit with zero incident rows, or a row missing its
  // type/time/details/status, neither of which web or Flutter's own client
  // validation allow. Matches collectValidationIssues.ts's dedicated
  // incidents block.
  const incidentsToggleId = resolveIncidentsToggleId(templateFields);
  if (incidentsToggleId && isYes(dataJson[incidentsToggleId])) {
    const incidentRows = Array.isArray(dataJson[INCIDENTS_ARRAY_KEY])
      ? (dataJson[INCIDENTS_ARRAY_KEY] as unknown[])
      : [];
    const hasIncompleteIncident = incidentRows.some((row) =>
      isRowMissingFields(row, INCIDENT_ROW_REQUIRED_FIELDS),
    );
    if (
      (incidentRows.length === 0 || hasIncompleteIncident) &&
      !missingFieldIds.includes(INCIDENTS_ARRAY_KEY)
    ) {
      missingFieldIds.push(INCIDENTS_ARRAY_KEY);
    }
  }

  if (missingFieldIds.length === 0) return { ok: true };
  return { ok: false, missingFieldIds };
}
