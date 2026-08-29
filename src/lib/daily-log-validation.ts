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
 */
export function validateDailyLogSubmit(
  dataJson: Record<string, unknown>,
  templateFields: unknown,
): SubmitValidationResult {
  const allFields = flattenTemplateFields(templateFields);
  if (allFields.length === 0) {
    // No template structure — only empty-object guard elsewhere.
    return { ok: true };
  }

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

    if (isValueEmpty(dataJson[fieldId])) {
      missingFieldIds.push(fieldId);
    }
  }

  if (missingFieldIds.length === 0) return { ok: true };
  return { ok: false, missingFieldIds };
}
