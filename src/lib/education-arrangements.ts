// Canonical source for the child profile field "Education Arrangements"
// (stored at children.life_story_data.education_arrangement) and its Daily
// Log Section 2 consequences. Mirrored in figapp-new's
// src/constants/educationArrangements.ts and figapp-flutter's
// lib/features/daily_logs/domain/education_arrangements.dart -- keep the
// EDUCATION_ARRANGEMENT_OPTIONS / LEGACY_TO_CANONICAL / id mapping in sync
// across all three.

export type EducationArrangementId =
  | "formal_schooling"
  | "home_learning"
  | "early_years"
  | "sixteen_plus"
  | "not_in_eet";

export const EDUCATION_ARRANGEMENT_OPTIONS = [
  "Formal Schooling",
  "Home Learning or Tuition",
  "Early Years or Not Yet School Age",
  "16+ Education, Employment or Training",
  "Not currently in education, employment or training",
] as const;

export type EducationArrangementLabel =
  (typeof EDUCATION_ARRANGEMENT_OPTIONS)[number];

// Raw stored value -> canonical label. Covers both the pre-v2.4 slash-form
// labels (Rule B of the spec: "or" not "/") and the older legacy aliases
// that already existed before this project.
const LEGACY_TO_CANONICAL: Record<string, EducationArrangementLabel> = {
  "Home Learning / Tuition": "Home Learning or Tuition",
  "Home Learning/Tuitions": "Home Learning or Tuition",
  "Early Years / Not Yet School Age": "Early Years or Not Yet School Age",
  "16+ (in work/trade)": "16+ Education, Employment or Training",
};

export function normalizeEducationArrangement(value: unknown): string {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "";
  return LEGACY_TO_CANONICAL[text] ?? text;
}

const CANONICAL_ID_BY_LABEL: Record<
  EducationArrangementLabel,
  EducationArrangementId
> = {
  "Formal Schooling": "formal_schooling",
  "Home Learning or Tuition": "home_learning",
  "Early Years or Not Yet School Age": "early_years",
  "16+ Education, Employment or Training": "sixteen_plus",
  "Not currently in education, employment or training": "not_in_eet",
};

/**
 * Exact-match canonicalization. Replaces the old substring-matching
 * (isSchoolEducationSectionDisabled / isHomeLearningEducationArrangement),
 * which broke the moment a value's text could satisfy more than one bucket
 * -- the new "...employment or training" label contains the exact substrings
 * ("employment", "training") the old 16+ check used, so adding it under the
 * old scheme would have silently misclassified it. Unrecognized or empty
 * values fall back to Formal Schooling, matching the spec's "missing
 * arrangement -> show the Formal Schooling set" rule.
 */
export function canonicalEducationArrangementId(
  value: unknown,
): EducationArrangementId {
  const normalized = normalizeEducationArrangement(value);
  return (
    CANONICAL_ID_BY_LABEL[normalized as EducationArrangementLabel] ??
    "formal_schooling"
  );
}

/** dataJson key a log's arrangement is frozen under at creation time. */
export const EDUCATION_ARRANGEMENT_SNAPSHOT_KEY = "education_arrangement_snapshot";

/**
 * Spec Section 2 Branching: "Existing logs are frozen: a log keeps the
 * question set it was created with." Prefers the value frozen into
 * dataJson on first save over a fresh live lookup of the child's current
 * profile; falls back to the live value for logs saved before this existed
 * (they never got a snapshot, so nothing to prefer).
 */
export function resolveEducationArrangementForLog(
  dataJson: Record<string, unknown> | null | undefined,
  liveValue: string | null,
): string | null {
  const snapshot = dataJson?.[EDUCATION_ARRANGEMENT_SNAPSHOT_KEY];
  if (typeof snapshot === "string" && snapshot.trim()) return snapshot;
  return liveValue;
}

/** Freezes the arrangement into a brand-new log's dataJson on first create,
 * never overwritten afterwards -- see resolveEducationArrangementForLog. */
export function withEducationArrangementSnapshot(
  dataJson: Record<string, unknown>,
  arrangement: string | null,
): Record<string, unknown> {
  if (dataJson[EDUCATION_ARRANGEMENT_SNAPSHOT_KEY] !== undefined) return dataJson;
  if (!arrangement) return dataJson;
  return { ...dataJson, [EDUCATION_ARRANGEMENT_SNAPSHOT_KEY]: arrangement };
}

/** Section title shown to the carer -- arrangement-aware per spec Section 2 Branching. */
export function schoolSectionTitleFor(id: EducationArrangementId): string {
  switch (id) {
    case "formal_schooling":
      return "School";
    case "home_learning":
      return "Home Learning or Tuition";
    case "early_years":
      return "Early Years";
    case "sixteen_plus":
      return "Education, Employment or Training";
    case "not_in_eet":
      return "Learning & Development";
  }
}
