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
 * Basic submit validation:
 * - every field with required=true must be non-empty
 * - meta.role=items: only required when the group's toggle answers Yes
 *   (even if items.required is false in the template)
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

    // If an items field somehow has required=true but we already handled it above.
    if (isValueEmpty(dataJson[fieldId])) {
      missingFieldIds.push(fieldId);
    }
  }

  if (missingFieldIds.length === 0) return { ok: true };
  return { ok: false, missingFieldIds };
}
