import type { SupabaseClient } from "@supabase/supabase-js";
import { getCarerHouseholdIds } from "../../lib/households.js";
import { toDailyLogListItemDto } from "../../mappers/daily-logs.js";
import {
  listAssignmentsByDate,
  listIncompleteAssignmentsInRange,
} from "../../repositories/daily-logs.js";
import type {
  DailyLogAssignmentListRow,
  DailyLogsListDto,
} from "../../types/daily-logs.js";
import { loadSubjectNames, resolveSubjectName } from "./subjects.js";
import {
  resolveDailyLogsListQuery,
  type DailyLogsListOptions,
} from "./list-query.js";

export async function listDailyLogsForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: DailyLogsListOptions,
): Promise<{
  data: DailyLogsListDto | null;
  error: Error | null;
  badRequest?: boolean;
}> {
  const query = resolveDailyLogsListQuery(options);
  if (!query.ok) {
    return { data: null, error: null, badRequest: true };
  }

  const { householdIds, error: householdError } = await getCarerHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }
  if (householdIds.length === 0) {
    return { data: { items: [] }, error: null };
  }

  const listed =
    query.kind === "overdue"
      ? await listIncompleteAssignmentsInRange(supabase, householdIds, {
          beforeDate: query.beforeDate,
        })
      : await listAssignmentsByDate(supabase, householdIds, query.assignedDate);

  if (listed.error) {
    return { data: null, error: listed.error };
  }

  const mapped = await mapAssignmentRows(supabase, listed.data);
  if (mapped.error) {
    return { data: null, error: mapped.error };
  }

  // Overdue SQL is pending + assigned_date < today (not started).
  // Do not also require isOverdue — that drops pending assignments whose nested
  // log looks completed, which the web dashboard still counts.
  return { data: { items: mapped.items }, error: null };
}

async function mapAssignmentRows(
  supabase: SupabaseClient,
  rows: DailyLogAssignmentListRow[],
): Promise<{ items: DailyLogsListDto["items"]; error: Error | null }> {
  if (rows.length === 0) {
    return { items: [], error: null };
  }

  const { childNames, parentNames } = await loadSubjectNames(supabase, rows);

  return {
    items: rows.map((row) =>
      toDailyLogListItemDto(
        row,
        resolveSubjectName(row, childNames, parentNames),
      ),
    ),
    error: null,
  };
}
