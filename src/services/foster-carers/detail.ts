import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveHouseholdLinkForToday } from "../../lib/placement-status.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toFosterCarerDto } from "../../mappers/foster-carers.js";
import {
  listCarerDetailProfilesByUserIds,
  listCarersForHouseholds,
  listHouseholdsByIds,
} from "../../repositories/households.js";
import type { FosterCarerDto } from "../../types/foster-carers.js";
import { resolveSupervisoryScope } from "./common.js";

export async function getFosterCarerForCaller(
  supabase: SupabaseClient,
  callerUserId: string,
  targetUserId: string,
) {
  const { scope, failure } = await resolveSupervisoryScope(supabase, callerUserId);
  if (failure) return failure;

  const { fosterCarerUserIds, householdIds } = scope!;
  // Not-found, not forbidden — matches this backend's convention elsewhere
  // (e.g. surveys ACL) of not revealing whether an id exists outside scope.
  if (!fosterCarerUserIds.includes(targetUserId)) {
    return serviceFailure({ notFound: true });
  }

  const [profilesRes, carerLinksRes, householdsRes] = await Promise.all([
    listCarerDetailProfilesByUserIds(supabase, [targetUserId]),
    listCarersForHouseholds(supabase, householdIds),
    listHouseholdsByIds(supabase, householdIds),
  ]);

  if (profilesRes.error) return serviceFailure({ error: profilesRes.error });
  if (carerLinksRes.error) return serviceFailure({ error: carerLinksRes.error });
  if (householdsRes.error) return serviceFailure({ error: householdsRes.error });

  const profile = profilesRes.data[0];
  if (!profile || profile.role !== "foster_carer") {
    return serviceFailure({ notFound: true });
  }

  const householdIdsForCarer = carerLinksRes.data
    .filter(
      (link) =>
        link.user_id === targetUserId && isActiveHouseholdLinkForToday(link),
    )
    .map((link) => link.household_id);

  const householdsById = new Map(householdsRes.data.map((h) => [h.id, h]));

  return serviceSuccess<FosterCarerDto>(
    toFosterCarerDto({
      profile,
      householdIds: householdIdsForCarer,
      householdsById,
    }),
  );
}
