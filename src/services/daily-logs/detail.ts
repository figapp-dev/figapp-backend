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
import { loadSubjectNames, resolveSubjectName } from "./subjects.js";

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

  const { childNames, parentNames, error: namesError } = await loadSubjectNames(
    supabase,
    [row],
  );
  if (namesError) {
    return { data: null, error: namesError };
  }

  const existingLog = pickLogForAssignment(row);
  let contributors: DailyLogContributorDto[] = [];
  if (existingLog?.id) {
    const loaded = await loadContributorsForLog(supabase, existingLog.id);
    if (loaded.error) {
      return { data: null, error: loaded.error };
    }
    contributors = loaded.data;
  }

  return {
    data: toDailyLogDetailDto(
      row,
      resolveSubjectName(row, childNames, parentNames),
      contributors,
    ),
    error: null,
  };
}
