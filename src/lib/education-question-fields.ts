import type { EducationArrangementId } from "./education-arrangements.js";

// Field-id side of the Section 2 rebuild (spec v2.4, ED-A..E tables). The
// question text/options/UI live client-side (web's education_question_sets.ts,
// Flutter's education_question_sets.dart) -- this file only needs to know
// which dataJson keys back each arrangement's attendance/gate questions, so
// validateDailyLogSubmit can compute required-ness without a live template.
//
// attended_on_time / reason_for_lateness / progress_from_school /
// school_attachments are shared storage between formal_schooling and
// home_learning (ED-B3-B6 reuse ED-A3/A4/A5/A6's fields per the spec) -- safe
// because a log is built under exactly one arrangement at a time.

type AttendanceFieldIds = {
  attendedId: string;
  absenceId: string;
  onTimeId: string;
  latenessId: string;
};

const ATTENDANCE_FIELD_IDS: Record<
  Exclude<EducationArrangementId, "not_in_eet">,
  AttendanceFieldIds
> = {
  formal_schooling: {
    attendedId: "attended_school",
    absenceId: "reason_for_absence",
    onTimeId: "attended_on_time",
    latenessId: "reason_for_lateness",
  },
  home_learning: {
    // New storage, not attended_school/reason_for_absence -- reusing those
    // would corrupt mapDailyLogToReportRows.ts's "attended school" report
    // column with home-learning data.
    attendedId: "home_learning_attended",
    absenceId: "home_learning_absence_reason",
    onTimeId: "attended_on_time",
    latenessId: "reason_for_lateness",
  },
  early_years: {
    attendedId: "nursery_attended",
    absenceId: "nursery_absence_reason",
    onTimeId: "nursery_on_time",
    latenessId: "nursery_late_reason",
  },
  sixteen_plus: {
    attendedId: "eet_attended",
    absenceId: "eet_absence_reason",
    onTimeId: "eet_on_time",
    latenessId: "eet_late_reason",
  },
};

export const NOT_IN_EET_FIELD_IDS = {
  participatedId: "learning_development_participated",
  detailsId: "learning_development_details",
} as const;

/** Every dataJson key the Education section's dedicated validation logic
 * owns, across all 5 arrangements -- excluded from the generic
 * template-driven required-field loop in daily-log-validation.ts so the two
 * code paths never double-handle (or conflict on) the same field id. */
export const EDUCATION_HANDLED_FIELD_IDS: ReadonlySet<string> = new Set([
  ...Object.values(ATTENDANCE_FIELD_IDS).flatMap((ids) => [
    ids.attendedId,
    ids.absenceId,
    ids.onTimeId,
    ids.latenessId,
  ]),
  NOT_IN_EET_FIELD_IDS.participatedId,
  NOT_IN_EET_FIELD_IDS.detailsId,
]);

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

function isYes(value: unknown): boolean {
  return norm(value) === "yes";
}

/**
 * Required Education/School field ids for this submission, given the
 * resolved canonical arrangement and the current dataJson answers. Mirrors
 * the ED-A..E flow table (spec v2.4 section 2): gate=No -> reason required;
 * gate=Yes -> on-time required, and late reason required only if
 * on-time=No. Comments/photos (Q5/Q6, E3/E4) are always optional. Gate
 * answers that mean "not applicable" (School Holiday / No session
 * scheduled / Not scheduled today) require nothing further.
 */
export function requiredEducationFieldIds(
  arrangementId: EducationArrangementId,
  dataJson: Record<string, unknown>,
): Set<string> {
  const required = new Set<string>();

  if (arrangementId === "not_in_eet") {
    required.add(NOT_IN_EET_FIELD_IDS.participatedId);
    if (isYes(dataJson[NOT_IN_EET_FIELD_IDS.participatedId])) {
      required.add(NOT_IN_EET_FIELD_IDS.detailsId);
    }
    return required;
  }

  const ids = ATTENDANCE_FIELD_IDS[arrangementId];
  required.add(ids.attendedId);
  const attended = norm(dataJson[ids.attendedId]);
  if (attended === "yes") {
    required.add(ids.onTimeId);
    if (norm(dataJson[ids.onTimeId]) === "no") {
      required.add(ids.latenessId);
    }
  } else if (attended === "no") {
    required.add(ids.absenceId);
  }
  return required;
}
