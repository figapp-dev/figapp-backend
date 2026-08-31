/** Mirrors figapp-new's src/constants/parentingAssessmentSection.ts and
 * src/constants/biologicalParentPortal.ts so mobile gets the same
 * "Parenting Assessment" section web already shows on eligible logs.
 */

export const PARENTING_ASSESSMENT_SECTION_ID = "parenting_assessment";

const BIOLOGICAL_PARENT_PORTAL_MAX_AGE_EXCLUSIVE = 18;

export type PlacedParentOption = {
  id: string;
  name: string;
  relationship: string;
};

export type PlacedParentWithDob = PlacedParentOption & {
  dateOfBirth: string | null;
};

/** Same calendar-age calculation as web's calculateBiologicalParentAge. */
export function calculateBiologicalParentAge(
  dateOfBirth: string | null | undefined,
  onDate: Date = new Date(),
): number | null {
  if (!dateOfBirth) return null;
  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;

  let age = onDate.getFullYear() - birth.getFullYear();
  const monthDiff = onDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && onDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/** 18+ placed parent — no separate parent daily log; assessment lives on the child's log. */
export function isBiologicalParentAdultForParentingAssessment(
  dateOfBirth: string | null | undefined,
): boolean {
  const age = calculateBiologicalParentAge(dateOfBirth);
  if (age === null) return false;
  return age >= BIOLOGICAL_PARENT_PORTAL_MAX_AGE_EXCLUSIVE;
}

/** Under 18 — parent gets their own daily log with parenting assessment on that log. */
export function isBiologicalParentUnder18ForOwnDailyLog(
  dateOfBirth: string | null | undefined,
): boolean {
  const age = calculateBiologicalParentAge(dateOfBirth);
  if (age === null) return false;
  return age > 0 && age < BIOLOGICAL_PARENT_PORTAL_MAX_AGE_EXCLUSIVE;
}

function formatParentOption(parent: PlacedParentOption): string {
  return `${parent.name} (${parent.relationship})`;
}

/** Plain JSON template-section shape matching daily_log_templates.template_fields. */
export function createParentingAssessmentSection(
  placedParents: PlacedParentOption[],
): Record<string, unknown> {
  const parentAssessedField =
    placedParents.length > 1
      ? [
          {
            id: "parenting_assessed_parent",
            type: "select",
            label: "Parent assessed",
            required: true,
            options: placedParents.map(formatParentOption),
          },
        ]
      : [];

  return {
    id: PARENTING_ASSESSMENT_SECTION_ID,
    title: "Parenting Assessment",
    fields: [
      ...parentAssessedField,
      {
        id: "parenting_daily_observations",
        type: "textarea",
        label: "Daily observations of parenting",
        required: true,
      },
      {
        id: "parenting_care_meeting_needs",
        type: "select",
        label: "Meeting child's care needs",
        required: true,
        options: ["Excellent", "Good", "Fair", "Concern"],
      },
      {
        id: "parenting_safety_awareness",
        type: "select",
        label: "Safety awareness",
        required: true,
        options: ["Excellent", "Good", "Fair", "Concern"],
      },
      {
        id: "parenting_emotional_regulation",
        type: "select",
        label: "Emotional regulation",
        required: true,
        options: ["Excellent", "Good", "Fair", "Concern"],
      },
      {
        id: "parenting_concerns",
        type: "textarea",
        label: "Concerns or follow-up notes",
        required: false,
      },
      {
        id: "parenting_follow_up_needed",
        type: "select",
        label: "Follow-up needed",
        required: true,
        options: ["Yes", "No"],
      },
    ],
  };
}

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function isParentingAssessmentSection(section: unknown): boolean {
  if (!section || typeof section !== "object") return false;
  const { id, title } = section as { id?: unknown; title?: unknown };
  if (id === PARENTING_ASSESSMENT_SECTION_ID) return true;
  const t = norm(title);
  return t.includes("parenting") && t.includes("assessment");
}

function isIncidentsFinalCommentsSection(section: unknown): boolean {
  if (!section || typeof section !== "object") return false;
  const t = norm((section as { title?: unknown }).title);
  return t.includes("incidents") && t.includes("final");
}

/**
 * Strips any parenting-assessment section already in templateFields, then
 * (when `section` is non-null) re-inserts it right before the "Incidents &
 * final comments" section — same position web places it in.
 */
export function insertParentingAssessmentSection(
  templateFields: unknown,
  section: Record<string, unknown> | null,
): unknown {
  if (!Array.isArray(templateFields)) return templateFields;

  const withoutExisting = templateFields.filter(
    (item) => !isParentingAssessmentSection(item),
  );
  if (!section) return withoutExisting;

  const incidentsIndex = withoutExisting.findIndex((item) =>
    isIncidentsFinalCommentsSection(item),
  );
  if (incidentsIndex < 0) return [...withoutExisting, section];

  return [
    ...withoutExisting.slice(0, incidentsIndex),
    section,
    ...withoutExisting.slice(incidentsIndex),
  ];
}
