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

/**
 * Field ids that live under a School/Education-titled section. The chat/form
 * UI (web + Flutter) never asks these when isSchoolEducationSectionDisabled
 * is true, so submit must not require them either — matches
 * useDailyLogFieldVisibility.ts's schoolVisibleFieldIds on web.
 */
function schoolSectionFieldIds(templateFields: unknown): Set<string> {
  const ids = new Set<string>();
  if (!Array.isArray(templateFields)) return ids;
  for (const section of templateFields) {
    if (!section || typeof section !== "object") continue;
    const { title, fields } = section as { title?: unknown; fields?: unknown };
    if (!isSchoolEducationSectionTitle(title) || !Array.isArray(fields)) {
      continue;
    }
    for (const field of fields) {
      const id = (field as TemplateFieldLike | null)?.id;
      if (typeof id === "string" && id.trim()) ids.add(id);
    }
  }
  return ids;
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
 * Submit validation matches the chat/form UI:
 * - every visible required field must be non-empty
 * - meta.role=items: only required when the group's toggle answers Yes
 * - Yes/No follow-ups (allowance amount, chores list, late details, …)
 *   are not required while their parent answer keeps them hidden
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

    if (!isFieldRequired(field)) continue;
    if (isInactiveFollowUp(fieldId, dataJson)) continue;
    if (exemptSchoolFieldIds?.has(fieldId)) continue;

    if (isValueEmpty(dataJson[fieldId])) {
      missingFieldIds.push(fieldId);
    }
  }

  if (missingFieldIds.length === 0) return { ok: true };
  return { ok: false, missingFieldIds };
}
