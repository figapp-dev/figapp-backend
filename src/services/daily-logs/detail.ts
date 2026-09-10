import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import {
  pickLogForAssignment,
  toDailyLogDetailDto,
} from "../../mappers/daily-logs.js";
import { findAssignmentForHouseholds } from "../../repositories/daily-logs.js";
import type {
  DailyLogContributorDto,
  DailyLogDetailDto,
} from "../../types/daily-logs.js";
import { loadContributorsForLog } from "./contributors.js";
import { loadParentingAssessmentSection } from "./parenting-assessment.js";
import {
  loadEducationArrangement,
  loadSubjectNames,
  resolveSubjectName,
} from "./subjects.js";

export async function getDailyLogForCarer(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
): Promise<{ data: DailyLogDetailDto | null; error: Error | null }> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }
  if (householdIds.length === 0) {
    return { data: null, error: null };
  }

  const { data: row, error: assignmentError } = await findAssignmentForHouseholds(
    supabase,
    assignmentId,
    householdIds,
  );

  if (assignmentError) {
    return { data: null, error: assignmentError };
  }
  if (!row) {
    return { data: null, error: null };
  }

  const existingLog = pickLogForAssignment(row);
  const [
    { childNames, parentNames },
    educationArrangement,
    parentingAssessmentSection,
    contributorsResult,
  ] = await Promise.all([
    loadSubjectNames(supabase, [row]),
    loadEducationArrangement(supabase, row.child_id),
    loadParentingAssessmentSection(supabase, row),
    existingLog?.id
      ? loadContributorsForLog(supabase, existingLog.id)
      : Promise.resolve({
          data: [] as DailyLogContributorDto[],
          error: null as Error | null,
        }),
  ]);

  if (contributorsResult.error) {
    return { data: null, error: contributorsResult.error };
  }

  return {
    data: toDailyLogDetailDto(
      row,
      resolveSubjectName(row, childNames, parentNames),
      contributorsResult.data,
      educationArrangement,
      parentingAssessmentSection,
    ),
    error: null,
  };
}
