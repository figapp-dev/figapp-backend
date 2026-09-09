import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toEligibleChildDto, toEligibleUserDto } from "../../mappers/calendar.js";
import { listChildrenByIds } from "../../repositories/children.js";
import {
  findOwnAgencyId,
  listAgencyUsersByRole,
  listHouseholdCarerLinksForUser,
  listOtherActiveHouseholdCarerUserIds,
  listSocialWorkerIdsForChildren,
} from "../../repositories/calendar.js";
import { getActiveChildPlacements } from "../children/shared.js";
import type { EligibleParticipantsDto } from "../../types/calendar.js";

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
 * figapp-new/modules/events/components/AddEventDialog.tsx:
 *   - children: placed with the carer's active household(s) (tag only,
 *     not invited as event_participants)
 *   - linkedCarers: other active carers in the same household(s)
 *   - socialWorkers: the household's assigned social worker(s) plus each
 *     placed child's own social_worker_id */
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
  const swIdsFromHousehold = links
    .map((l) => l.social_worker_id)
    .filter((id): id is string => Boolean(id));

  const { placements, error: placementsError } = await getActiveChildPlacements(
    supabase,
    householdIds,
  );
  if (placementsError) return serviceFailure({ error: placementsError });

  const [childrenResult, swFromChildrenResult, otherCarersResult, agencyIdResult] =
    await Promise.all([
      listChildrenByIds(supabase, placements.childIds),
      listSocialWorkerIdsForChildren(supabase, placements.childIds),
      listOtherActiveHouseholdCarerUserIds(supabase, householdIds, userId),
      findOwnAgencyId(supabase, userId),
    ]);

  if (childrenResult.error) return serviceFailure({ error: childrenResult.error });
  if (swFromChildrenResult.error) {
    return serviceFailure({ error: swFromChildrenResult.error });
  }
  if (otherCarersResult.error) return serviceFailure({ error: otherCarersResult.error });
  if (agencyIdResult.error) return serviceFailure({ error: agencyIdResult.error });

  const agencyId = agencyIdResult.data;
  const children = childrenResult.data.map(toEligibleChildDto);

  if (!agencyId) {
    return serviceSuccess({ ...EMPTY, children });
  }

  const socialWorkerIds = [
    ...new Set([...swIdsFromHousehold, ...swFromChildrenResult.data]),
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
