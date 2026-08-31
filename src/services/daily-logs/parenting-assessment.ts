import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createParentingAssessmentSection,
  isBiologicalParentAdultForParentingAssessment,
  isBiologicalParentUnder18ForOwnDailyLog,
  type PlacedParentOption,
} from "../../lib/parenting-assessment.js";
import { listActivePlacedParents } from "../../repositories/daily-logs.js";

type AssignmentSubjectRow = {
  child_id: string | null;
  household_id: string | null;
  biological_parent_id: string | null;
};

/**
 * 18+ placed parents → parenting assessment appears on the child's daily log.
 * Under-18 placed parents → parenting assessment appears on the parent's own
 * (placed_parent) daily log instead. Best-effort: a lookup failure must not
 * block opening or saving the log, so this returns null rather than throwing.
 */
export async function loadParentingAssessmentSection(
  supabase: SupabaseClient,
  row: AssignmentSubjectRow,
): Promise<Record<string, unknown> | null> {
  const childId = row.child_id;
  const householdId = row.household_id;
  if (!childId || !householdId) return null;

  const { data, error } = await listActivePlacedParents(
    supabase,
    childId,
    householdId,
  );
  if (error) return null;

  const placedParents: (PlacedParentOption & { dateOfBirth: string | null })[] =
    data
      .map((placement) => placement.child_biological_parents)
      .filter((parent): parent is NonNullable<typeof parent> => !!parent?.id)
      .map((parent) => ({
        id: parent.id,
        name: parent.name?.trim() || "Parent",
        relationship: parent.relationship?.trim() || "Parent",
        dateOfBirth: parent.date_of_birth ?? null,
      }));

  const isPlacedParentLog = !!row.biological_parent_id;

  if (isPlacedParentLog) {
    const thisParent = placedParents.find(
      (parent) => parent.id === row.biological_parent_id,
    );
    if (
      thisParent &&
      isBiologicalParentUnder18ForOwnDailyLog(thisParent.dateOfBirth)
    ) {
      return createParentingAssessmentSection([thisParent]);
    }
    return null;
  }

  const adultParents = placedParents.filter((parent) =>
    isBiologicalParentAdultForParentingAssessment(parent.dateOfBirth),
  );
  if (adultParents.length === 0) return null;
  return createParentingAssessmentSection(adultParents);
}
