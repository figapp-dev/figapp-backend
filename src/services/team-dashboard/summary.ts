import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCallerContext } from "../../lib/caller-context.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import { filterAssignmentsToActivePlacements } from "../../lib/daily-log-placements.js";
import { isActiveHousehold, isCurrentlyActivePlacement } from "../../lib/placement-status.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { resolveScopeForRole } from "../../lib/social-worker-scope.js";
import { toTeamDashboardSummaryDto } from "../../mappers/team-dashboard.js";
import {
  fetchChildPlacementsForHouseholds,
  fetchParentPlacementsForHouseholds,
  listIncompleteAssignmentsInRange,
} from "../../repositories/daily-logs.js";
import { listHouseholdsByIds } from "../../repositories/households.js";
import type { DailyLogAssignmentListRow } from "../../types/daily-logs.js";
import type { TeamDashboardSummaryDto } from "../../types/team-dashboard.js";
import { listDocumentsForCarer } from "../documents/list.js";
import { listSurveysForCarer } from "../surveys/index.js";

const SUPERVISORY_ROLES = new Set(["social_worker", "sw_manager"]);

/**
 * Every Team Dashboard card in one round trip: resolves the caller's
 * scope once (resolveScopeForRole does 2-3 Supabase calls internally)
 * and fans the rest out in parallel, rather than making the client hit a
 * separate endpoint per card. social_worker/sw_manager only — this is the
 * supervisory landing screen, not a foster_carer feature.
 */
export async function getTeamDashboardSummary(
  supabase: SupabaseClient,
  userId: string,
) {
  const callerRes = await resolveCallerContext(supabase, userId);
  if (callerRes.error) return serviceFailure({ error: callerRes.error });

  const caller = callerRes.data;
  if (!caller || !SUPERVISORY_ROLES.has(caller.role ?? "") || !caller.isActive) {
    return serviceFailure({ forbidden: true });
  }
  const role = caller.role as "social_worker" | "sw_manager";

  const { scope, error: scopeError } = await resolveScopeForRole(
    supabase,
    userId,
    role,
  );
  if (scopeError) return serviceFailure({ error: scopeError });

  const { householdIds, fosterCarerUserIds } = scope;
  const today = getTodayUKDateString();

  const overduePromise: Promise<{
    data: DailyLogAssignmentListRow[];
    error: Error | null;
  }> =
    householdIds.length > 0
      ? listIncompleteAssignmentsInRange(supabase, householdIds, {
          beforeDate: today,
        })
      : Promise.resolve({ data: [], error: null });

  const [
    householdsRes,
    childPlacementsRes,
    parentPlacementsRes,
    overdueRes,
    documentsRes,
    surveysRes,
  ] = await Promise.all([
    listHouseholdsByIds(supabase, householdIds),
    fetchChildPlacementsForHouseholds(supabase, householdIds),
    fetchParentPlacementsForHouseholds(supabase, householdIds),
    overduePromise,
    listDocumentsForCarer(supabase, userId),
    listSurveysForCarer(supabase, userId),
  ]);

  if (householdsRes.error) return serviceFailure({ error: householdsRes.error });
  if (childPlacementsRes.error) {
    return serviceFailure({ error: childPlacementsRes.error });
  }
  if (parentPlacementsRes.error) {
    return serviceFailure({ error: parentPlacementsRes.error });
  }
  if (overdueRes.error) return serviceFailure({ error: overdueRes.error });
  if (documentsRes.error) return serviceFailure({ error: documentsRes.error });
  if (surveysRes.error) return serviceFailure({ error: surveysRes.error });

  const households = householdsRes.data.filter(isActiveHousehold).length;

  const children =
    childPlacementsRes.data.filter(isCurrentlyActivePlacement).length +
    parentPlacementsRes.data.filter(isCurrentlyActivePlacement).length;

  const dailyLogsOverdue = filterAssignmentsToActivePlacements(
    overdueRes.data,
    childPlacementsRes.data,
    parentPlacementsRes.data,
  ).length;

  const documentsToReview = documentsRes.data?.toReviewCount ?? 0;

  const surveysToDo = (surveysRes.data?.items ?? []).filter(
    (item) =>
      item.receiverStatus === "active" || item.receiverStatus === "in_progress",
  ).length;

  return serviceSuccess<TeamDashboardSummaryDto>(
    toTeamDashboardSummaryDto({
      fosterCarers: fosterCarerUserIds.length,
      households,
      children,
      dailyLogsOverdue,
      documentsToReview,
      surveysToDo,
    }),
  );
}
