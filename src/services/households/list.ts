import type { SupabaseClient } from "@supabase/supabase-js";
import { getCarerHouseholdIds } from "../../lib/households.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toHouseholdListItemDto } from "../../mappers/households.js";
import {
  listCarersForHouseholds,
  listChildrenForHouseholds,
  listFosterCarerProfilesByUserIds,
  listHouseholdsByIds,
} from "../../repositories/households.js";
import type { HouseholdListDto } from "../../types/households.js";

export async function listHouseholdsForCarer(
  supabase: SupabaseClient,
  userId: string,
) {
  const { householdIds, error: idsError } = await getCarerHouseholdIds(
    supabase,
    userId,
  );
  if (idsError) return serviceFailure({ error: idsError });

  const { data: households, error: hhError } = await listHouseholdsByIds(
    supabase,
    householdIds,
  );
  if (hhError) return serviceFailure({ error: hhError });

  const { data: carerLinks, error: carersError } = await listCarersForHouseholds(
    supabase,
    householdIds,
  );
  if (carersError) return serviceFailure({ error: carersError });

  const { data: childRows, error: childrenError } =
    await listChildrenForHouseholds(supabase, householdIds);
  if (childrenError) return serviceFailure({ error: childrenError });

  const carerUserIds = [...new Set(carerLinks.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } =
    await listFosterCarerProfilesByUserIds(supabase, carerUserIds);
  if (profilesError) return serviceFailure({ error: profilesError });

  const profilesByUserId = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );

  const carersByHousehold = new Map<string, typeof carerLinks>();
  for (const link of carerLinks) {
    const list = carersByHousehold.get(link.household_id) ?? [];
    list.push(link);
    carersByHousehold.set(link.household_id, list);
  }

  const childrenByHousehold = new Map<string, typeof childRows>();
  for (const row of childRows) {
    const list = childrenByHousehold.get(row.household_id) ?? [];
    list.push(row);
    childrenByHousehold.set(row.household_id, list);
  }

  const items = households.map((household) =>
    toHouseholdListItemDto({
      household,
      carerLinks: carersByHousehold.get(household.id) ?? [],
      childRows: childrenByHousehold.get(household.id) ?? [],
      profilesByUserId,
      currentUserId: userId,
    }),
  );

  return serviceSuccess<HouseholdListDto>({ households: items });
}
