import type { SupabaseClient } from "@supabase/supabase-js";
import { filterAssignmentsToActivePlacements } from "../../lib/daily-log-placements.js";
import { getCarerHouseholdIds } from "../../lib/households.js";
import { toDailyLogListItemDto } from "../../mappers/daily-logs.js";
import {
  fetchChildPlacementsForHouseholds,
  fetchParentPlacementsForHouseholds,
  listAssignmentsByDate,
  listCompletedAssignments,
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
      : query.kind === "completed"
        ? await listCompletedAssignments(supabase, householdIds)
        : await listAssignmentsByDate(supabase, householdIds, query.assignedDate);

  if (listed.error) {
    return { data: null, error: listed.error };
  }

  // Pending/overdue/today rows must be dropped once the child (or placed
  // parent) they're for is no longer actively placed in that household —
  // nothing reliably clears every past-dated row the moment a placement
  // ends (matches web's DashboardContent.tsx comment on this exact issue),
  // so a stale row can otherwise linger forever and get shown to whoever is
  // next linked to that household. Completed rows are left alone: they're
  // a historical record of care actually given, not an outstanding task,
  // and web keeps those visible after a placement ends too.
  const rowsForKind =
    query.kind === "completed"
      ? listed.data
      : await filterToActivePlacements(supabase, householdIds, listed.data);

  const mapped = await mapAssignmentRows(supabase, rowsForKind);
  if (mapped.error) {
    return { data: null, error: mapped.error };
  }

  // Overdue SQL is "not completed" + assigned_date < today. Do not also
  // require isOverdue — that drops pending/in_progress assignments whose
  // nested log looks completed, which the web dashboard still counts.
  return { data: { items: mapped.items }, error: null };
}

async function filterToActivePlacements(
  supabase: SupabaseClient,
  householdIds: string[],
  rows: DailyLogAssignmentListRow[],
): Promise<DailyLogAssignmentListRow[]> {
  if (rows.length === 0) return rows;

  const [childPlacements, parentPlacements] = await Promise.all([
    fetchChildPlacementsForHouseholds(supabase, householdIds),
    fetchParentPlacementsForHouseholds(supabase, householdIds),
  ]);
  // A lookup failure here must not hide otherwise-valid rows — fall back
  // to the unfiltered list rather than erroring the whole request out.
  if (childPlacements.error || parentPlacements.error) return rows;

  return filterAssignmentsToActivePlacements(
    rows,
    childPlacements.data,
    parentPlacements.data,
  );
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
