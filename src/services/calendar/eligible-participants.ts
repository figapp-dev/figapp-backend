import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { resolveCallerContext } from "../../lib/caller-context.js";
import { isPortalEligibleChildAge } from "../../lib/age.js";
import { toEligibleChildDto, toEligibleUserDto } from "../../mappers/calendar.js";
import { listChildrenByIds } from "../../repositories/children.js";
import {
  findManagerId,
  findOwnAgencyId,
  findOwnSocialWorkerId,
  listActiveAgencyUsersByRoles,
  listAgencyPortalEligibleChildren,
  listAgencyUsersByRole,
  listHouseholdCarerLinksForUser,
  listOtherActiveHouseholdCarerUserIds,
  listSocialWorkerIdsForChildren,
} from "../../repositories/calendar.js";
import { getActiveChildPlacements } from "../children/shared.js";
import type { EligibleParticipantsDto } from "../../types/calendar.js";

const SUPERVISORY_ROLES = new Set(["social_worker", "sw_manager"]);

export type EligibleParticipantsResult =
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<EligibleParticipantsDto>>;

const EMPTY: EligibleParticipantsDto = {
  children: [],
  linkedCarers: [],
  socialWorkers: [],
};

/** Who a foster carer can tag/invite when creating an event — mirrors
 * fetchUsersAndChildren's `isFosterCarer` branch in
 * figapp-new/modules/events/components/AddEventDialog.tsx, corrected to use
 * the actual source of truth for a carer's social worker:
 *   - children: placed with the carer's active household(s) (tag only,
 *     not invited as event_participants)
 *   - linkedCarers: other active carers in the same household(s)
 *   - socialWorkers: the carer's own assigned social worker
 *     (`agency_users.social_worker_id` — set by "Link Households"; NOT
 *     `household_carers.social_worker_id`, which nothing ever writes) plus
 *     that social worker's own manager (SW manager), plus each placed
 *     child's own `social_worker_id`. See
 *     figapp-new/src/components/HouseholdProfileDialog.tsx for the same
 *     priority (agency_users.social_worker_id first, household_carers
 *     value only as a legacy fallback). */
export async function getEligibleParticipantsForCarer(
  supabase: SupabaseClient,
  userId: string,
): Promise<EligibleParticipantsResult> {
  const { data: links, error: linksError } = await listHouseholdCarerLinksForUser(
    supabase,
    userId,
  );
  if (linksError) return serviceFailure({ error: linksError });
  if (links.length === 0) return serviceSuccess(EMPTY);

  const householdIds = [...new Set(links.map((l) => l.household_id))];
  // Legacy fallback only — nothing writes household_carers.social_worker_id
  // in practice, but keep it as a safety net matching web's own fallback.
  const legacySwIdsFromHousehold = links
    .map((l) => l.social_worker_id)
    .filter((id): id is string => Boolean(id));

  const { placements, error: placementsError } = await getActiveChildPlacements(
    supabase,
    householdIds,
  );
  if (placementsError) return serviceFailure({ error: placementsError });

  const [
    childrenResult,
    swFromChildrenResult,
    otherCarersResult,
    agencyIdResult,
    ownSocialWorkerResult,
  ] = await Promise.all([
    listChildrenByIds(supabase, placements.childIds),
    listSocialWorkerIdsForChildren(supabase, placements.childIds),
    listOtherActiveHouseholdCarerUserIds(supabase, householdIds, userId),
    findOwnAgencyId(supabase, userId),
    findOwnSocialWorkerId(supabase, userId),
  ]);

  if (childrenResult.error) return serviceFailure({ error: childrenResult.error });
  if (swFromChildrenResult.error) {
    return serviceFailure({ error: swFromChildrenResult.error });
  }
  if (otherCarersResult.error) return serviceFailure({ error: otherCarersResult.error });
  if (agencyIdResult.error) return serviceFailure({ error: agencyIdResult.error });
  if (ownSocialWorkerResult.error) {
    return serviceFailure({ error: ownSocialWorkerResult.error });
  }

  const agencyId = agencyIdResult.data;
  const children = childrenResult.data.map(toEligibleChildDto);

  if (!agencyId) {
    return serviceSuccess({ ...EMPTY, children });
  }

  const ownSocialWorkerId = ownSocialWorkerResult.data ?? legacySwIdsFromHousehold[0] ?? null;
  const managerResult = ownSocialWorkerId
    ? await findManagerId(supabase, ownSocialWorkerId)
    : { data: null, error: null };
  if (managerResult.error) return serviceFailure({ error: managerResult.error });

  const socialWorkerIds = [
    ...new Set([
      ...(ownSocialWorkerId ? [ownSocialWorkerId] : []),
      ...(managerResult.data ? [managerResult.data] : []),
      ...legacySwIdsFromHousehold,
      ...swFromChildrenResult.data,
    ]),
  ];

  const [linkedCarersResult, socialWorkersResult] = await Promise.all([
    listAgencyUsersByRole(supabase, agencyId, otherCarersResult.data, [
      "foster_carer",
    ]),
    listAgencyUsersByRole(supabase, agencyId, socialWorkerIds, [
      "social_worker",
      "sw_manager",
    ]),
  ]);
  if (linkedCarersResult.error) return serviceFailure({ error: linkedCarersResult.error });
  if (socialWorkersResult.error) return serviceFailure({ error: socialWorkersResult.error });

  return serviceSuccess({
    children,
    linkedCarers: linkedCarersResult.data.map(toEligibleUserDto),
    socialWorkers: socialWorkersResult.data.map(toEligibleUserDto),
  });
}

/** Who a social_worker/sw_manager can tag/invite when creating an event —
 * mirrors the non-foster-carer branch of `fetchUsersAndChildren` in
 * figapp-new/modules/events/components/AddEventDialog.tsx:
 *   - linkedCarers/socialWorkers: the caller's entire agency roster (foster
 *     carers, and separately social_worker/sw_manager), excluding
 *     super_admin/app_admin and the caller themself. Deliberately
 *     agency-wide, NOT caseload-scoped — confirmed against web's source —
 *     unlike every other social_worker/sw_manager endpoint in this backend.
 *   - children (tag only, same as the carer branch): web's "Children (Age
 *     13+ with Portal Access)" list — `child_ovr13` rows (a separate
 *     child-portal-login table, not the `children` table), agency-wide,
 *     filtered to active + portal_access_enabled + age >= 13. */
async function getEligibleParticipantsForSupervisor(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<EligibleParticipantsResult> {
  const [carersResult, staffResult, childrenResult] = await Promise.all([
    listActiveAgencyUsersByRoles(supabase, agencyId, ["foster_carer"], userId),
    listActiveAgencyUsersByRoles(
      supabase,
      agencyId,
      ["social_worker", "sw_manager"],
      userId,
    ),
    listAgencyPortalEligibleChildren(supabase, agencyId),
  ]);
  if (carersResult.error) return serviceFailure({ error: carersResult.error });
  if (staffResult.error) return serviceFailure({ error: staffResult.error });
  if (childrenResult.error) return serviceFailure({ error: childrenResult.error });

  const children = childrenResult.data
    .filter((child) => isPortalEligibleChildAge(child.date_of_birth))
    .map(toEligibleChildDto);

  return serviceSuccess({
    children,
    linkedCarers: carersResult.data.map(toEligibleUserDto),
    socialWorkers: staffResult.data.map(toEligibleUserDto),
  });
}

/** Entry point the route calls — branches on the caller's own role. */
export async function getEligibleParticipantsForCaller(
  supabase: SupabaseClient,
  userId: string,
): Promise<EligibleParticipantsResult> {
  const callerRes = await resolveCallerContext(supabase, userId);
  if (callerRes.error) return serviceFailure({ error: callerRes.error });

  const caller = callerRes.data;
  if (caller && SUPERVISORY_ROLES.has(caller.role ?? "")) {
    if (!caller.agencyId) return serviceSuccess(EMPTY);
    return getEligibleParticipantsForSupervisor(supabase, userId, caller.agencyId);
  }

  return getEligibleParticipantsForCarer(supabase, userId);
}
