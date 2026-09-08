type TemplateFieldMeta = {
  group?: string;
  role?: string;
};

export type TemplateFieldLike = {
  id?: string;
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

/** Mirrors figapp-new's constants/educationArrangements.ts (canonical source). */
const LEGACY_TO_CANONICAL_ARRANGEMENT: Record<string, string> = {
  "Home Learning/Tuitions": "Home Learning / Tuition",
  "16+ (in work/trade)": "16+ Education, Employment or Training",
};

function normalizeEducationArrangement(value: unknown): string {
  const text = typeof value === "string" ? value : "";
  if (!text) return "";
  return LEGACY_TO_CANONICAL_ARRANGEMENT[text] ?? text;
}

/** School / education section does not apply (16+, early years, legacy 16+ labels). */
function isSchoolEducationSectionDisabled(
  arrangement: string | null | undefined,
): boolean {
  const a = norm(normalizeEducationArrangement(arrangement));
  if (!a) return false;

  if (a.includes("16+")) return true;
  if (a.includes("work/trade") || a.includes("in work")) return true;
  if (a.includes("employment") && a.includes("training")) return true;
  if (a.includes("early years")) return true;
  if (a.includes("not yet school")) return true;

  return false;
}

function isSchoolEducationSectionTitle(title: unknown): boolean {
  const t = norm(title);
  return t.includes("school") || t.includes("education");
}

/** All fields under a School/Education-titled section, in template order. */
function schoolSectionFields(templateFields: unknown): TemplateFieldLike[] {
  const out: TemplateFieldLike[] = [];
  if (!Array.isArray(templateFields)) return out;
  for (const section of templateFields) {
    if (!section || typeof section !== "object") continue;
    const { title, fields } = section as { title?: unknown; fields?: unknown };
    if (!isSchoolEducationSectionTitle(title) || !Array.isArray(fields)) {
      continue;
    }
    for (const field of fields) {
      if (field && typeof field === "object") out.push(field as TemplateFieldLike);
    }
  }
  return out;
}

/**
 * Field ids that live under a School/Education-titled section. The chat/form
 * UI (web + Flutter) never asks these when isSchoolEducationSectionDisabled
 * is true, so submit must not require them either — matches
 * useDailyLogFieldVisibility.ts's schoolVisibleFieldIds on web.
 */
function schoolSectionFieldIds(templateFields: unknown): Set<string> {
  const ids = new Set<string>();
  for (const field of schoolSectionFields(templateFields)) {
    if (typeof field.id === "string" && field.id.trim()) ids.add(field.id);
  }
  return ids;
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

type SchoolFollowUpIds = {
  attendedId: string;
  onTimeId: string;
  absenceId?: string;
  latenessId?: string;
};

function resolveSchoolFollowUpIds(templateFields: unknown): SchoolFollowUpIds {
  const fields = schoolSectionFields(templateFields);
  return {
    attendedId:
      findFieldId(fields, "attended school", "attended home learning", "attended tuition") ??
      "attended_school",
    onTimeId: findFieldId(fields, "attended on time") ?? "attended_on_time",
    absenceId: findFieldId(fields, "reason for absence", "absence reason"),
    latenessId: findFieldId(fields, "reason for lateness", "late reason"),
  };
}

/**
 * "Reason for absence"/"reason for lateness" only apply once the carer's
 * attendance answer opens them — matches _isSchoolFieldVisible on Flutter
 * and useDailyLogFieldVisibility.ts's schoolVisibleFieldIds on web. Without
 * this, a field the carer is never shown (because attended=Yes/on-time)
 * would still block submit.
 */
function isInactiveSchoolFollowUp(
  fieldId: string,
  dataJson: Record<string, unknown>,
  schoolIds: SchoolFollowUpIds,
): boolean {
  const attended = norm(dataJson[schoolIds.attendedId]);
  if (fieldId === schoolIds.onTimeId) {
    return attended !== "yes";
  }
  if (schoolIds.absenceId && fieldId === schoolIds.absenceId) {
    return attended !== "no";
  }
  if (schoolIds.latenessId && fieldId === schoolIds.latenessId) {
    const onTimeNo = norm(dataJson[schoolIds.onTimeId]) === "no";
    return !(attended === "yes" && onTimeNo);
  }
  return false;
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

export function isFieldRequired(field: TemplateFieldLike | null | undefined): boolean {
  if (!field) return false;
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
  schoolIds: SchoolFollowUpIds,
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

  const attended = norm(dataJson[schoolIds.attendedId]);
  if (attended === "no" && schoolIds.absenceId) {
    ids.add(schoolIds.absenceId);
  }
  if (
    attended === "yes" &&
    norm(dataJson[schoolIds.onTimeId]) === "no" &&
    schoolIds.latenessId
  ) {
    ids.add(schoolIds.latenessId);
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
 * - School/Education fields are not required when the child's education
 *   arrangement (16+, early years, …) disables that section — the carer is
 *   never shown those questions, so submit must not demand them either
 */
export function validateDailyLogSubmit(
  dataJson: Record<string, unknown>,
  templateFields: unknown,
  educationArrangement?: string | null,
): SubmitValidationResult {
  const allFields = flattenTemplateFields(templateFields);
  if (allFields.length === 0) {
    // No template structure — only empty-object guard elsewhere.
    return { ok: true };
  }

  const exemptSchoolFieldIds = isSchoolEducationSectionDisabled(
    educationArrangement,
  )
    ? schoolSectionFieldIds(templateFields)
    : null;
  const schoolFollowUpIds = resolveSchoolFollowUpIds(templateFields);
  const allFieldIds = new Set(
    allFields
      .map((f) => f.id)
      .filter((id): id is string => typeof id === "string" && id.trim().length > 0),
  );
  const codeRequiredIds = codeLevelRequiredFieldIds(
    dataJson,
    allFieldIds,
    schoolFollowUpIds,
  );

  const missingFieldIds: string[] = [];

  for (const field of allFields) {
    const fieldId = field.id;
    if (!fieldId) continue;

    const role = field.meta?.role;
    const group = field.meta?.group;

    if (role === "items" && group) {
      const toggle = allFields.find(
        (f) => f.meta?.group === group && f.meta?.role === "toggle",
      );
      const toggleVal = toggle?.id != null ? dataJson[toggle.id] : undefined;
      if (!isYes(toggleVal)) continue;

      if (isValueEmpty(dataJson[fieldId])) {
        missingFieldIds.push(fieldId);
      }
      continue;
    }

    if (!isFieldRequired(field) && !codeRequiredIds.has(fieldId)) continue;
    if (isInactiveFollowUp(fieldId, dataJson)) continue;
    if (exemptSchoolFieldIds?.has(fieldId)) continue;
    if (isInactiveSchoolFollowUp(fieldId, dataJson, schoolFollowUpIds)) continue;

    if (isValueEmpty(dataJson[fieldId])) {
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

  if (missingFieldIds.length === 0) return { ok: true };
  return { ok: false, missingFieldIds };
}
