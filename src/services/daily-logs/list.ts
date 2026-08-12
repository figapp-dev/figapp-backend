import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { getTodayUKDateString, toDateOnly } from "../../lib/dates.js";
import { toDailyLogListItemDto } from "../../mappers/daily-logs.js";
import { listAssignmentsByDate } from "../../repositories/daily-logs.js";
import type { DailyLogsListDto } from "../../types/daily-logs.js";
import { loadSubjectNames, resolveSubjectName } from "./subjects.js";

export async function listDailyLogsForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: { date?: string },
): Promise<{
  data: DailyLogsListDto | null;
  error: Error | null;
  badRequest?: boolean;
}> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }
  if (householdIds.length === 0) {
    return { data: { items: [] }, error: null };
  }

  let assignedDate: string;
  if (options?.date != null && String(options.date).trim() !== "") {
    const parsed = toDateOnly(options.date);
    if (!parsed) {
      return { data: null, error: null, badRequest: true };
    }
    assignedDate = parsed;
  } else {
    assignedDate = getTodayUKDateString();
  }

  const { data: rows, error: assignmentError } = await listAssignmentsByDate(
    supabase,
    householdIds,
    assignedDate,
  );

  if (assignmentError) {
    return { data: null, error: assignmentError };
  }
  if (rows.length === 0) {
    return { data: { items: [] }, error: null };
  }

  const { childNames, parentNames, error: namesError } = await loadSubjectNames(
    supabase,
    rows,
  );
  if (namesError) {
    return { data: null, error: namesError };
  }

  const items = rows.map((row) =>
    toDailyLogListItemDto(
      row,
      resolveSubjectName(row, childNames, parentNames),
    ),
  );

  return { data: { items }, error: null };
}
