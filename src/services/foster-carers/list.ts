import type { SupabaseClient } from "@supabase/supabase-js";
import { isActiveHouseholdLinkForToday } from "../../lib/placement-status.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toFosterCarerDto } from "../../mappers/foster-carers.js";
import {
  listCarerDetailProfilesByUserIds,
  listCarersForHouseholds,
  listHouseholdsByIds,
} from "../../repositories/households.js";
import type { FosterCarerListDto } from "../../types/foster-carers.js";
import { resolveSupervisoryScope } from "./common.js";

export async function listFosterCarersForCaller(
  supabase: SupabaseClient,
  callerUserId: string,
) {
  const { scope, failure } = await resolveSupervisoryScope(supabase, callerUserId);
  if (failure) return failure;

  const { fosterCarerUserIds, householdIds } = scope!;
  if (fosterCarerUserIds.length === 0) {
    return serviceSuccess<FosterCarerListDto>({ fosterCarers: [] });
  }

  const [profilesRes, carerLinksRes, householdsRes] = await Promise.all([
    listCarerDetailProfilesByUserIds(supabase, fosterCarerUserIds),
    listCarersForHouseholds(supabase, householdIds),
    listHouseholdsByIds(supabase, householdIds),
  ]);

  if (profilesRes.error) return serviceFailure({ error: profilesRes.error });
  if (carerLinksRes.error) return serviceFailure({ error: carerLinksRes.error });
  if (householdsRes.error) return serviceFailure({ error: householdsRes.error });

  const householdIdsByCarer = new Map<string, string[]>();
  for (const link of carerLinksRes.data) {
    if (!isActiveHouseholdLinkForToday(link)) continue;
    const list = householdIdsByCarer.get(link.user_id) ?? [];
    list.push(link.household_id);
    householdIdsByCarer.set(link.user_id, list);
  }

  const householdsById = new Map(householdsRes.data.map((h) => [h.id, h]));

  const fosterCarers = profilesRes.data
    .filter((profile) => profile.role === "foster_carer")
    .map((profile) =>
      toFosterCarerDto({
        profile,
        householdIds: householdIdsByCarer.get(profile.user_id) ?? [],
        householdsById,
      }),
    )
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return serviceSuccess<FosterCarerListDto>({ fosterCarers });
}
