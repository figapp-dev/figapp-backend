import type { SupabaseClient } from "@supabase/supabase-js";
import { getCarerHouseholdIds } from "../../lib/households.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toHouseholdDetailDto } from "../../mappers/households.js";
import {
  getHouseholdById,
  listCarerDetailProfilesByUserIds,
  listCarersForHouseholds,
  listChildrenForHouseholds,
  listParentPlacementsForHouseholds,
  listStaffProfilesByUserIds,
} from "../../repositories/households.js";
import {
  listBiologicalParentsByIds,
  listChildrenByIds,
} from "../../repositories/children.js";
import type { HouseholdDetailDto } from "../../types/households.js";

export async function getHouseholdDetailForCarer(
  supabase: SupabaseClient,
  userId: string,
  householdId: string,
) {
  const { householdIds, error: idsError } = await getCarerHouseholdIds(
    supabase,
    userId,
  );
  if (idsError) return serviceFailure({ error: idsError });
  if (!householdIds.includes(householdId)) {
    return serviceFailure({ notFound: true });
  }

  const { data: household, error: hhError } = await getHouseholdById(
    supabase,
    householdId,
  );
  if (hhError) return serviceFailure({ error: hhError });
  if (!household) return serviceFailure({ notFound: true });

  const householdIdsScoped = [householdId];

  const { data: carerLinks, error: carersError } = await listCarersForHouseholds(
    supabase,
    householdIdsScoped,
  );
  if (carersError) return serviceFailure({ error: carersError });

  const { data: childRows, error: childrenError } =
    await listChildrenForHouseholds(supabase, householdIdsScoped);
  if (childrenError) return serviceFailure({ error: childrenError });

  const { data: parentPlacements, error: parentPlacementsError } =
    await listParentPlacementsForHouseholds(supabase, householdIdsScoped);
  if (parentPlacementsError) {
    return serviceFailure({ error: parentPlacementsError });
  }

  const carerUserIds = [...new Set(carerLinks.map((row) => row.user_id))];
  const { data: carerProfiles, error: carerProfilesError } =
    await listCarerDetailProfilesByUserIds(
      supabase,
      carerUserIds,
      household.agency_id,
    );
  if (carerProfilesError) return serviceFailure({ error: carerProfilesError });

  const carerProfilesByUserId = new Map(
    carerProfiles.map((profile) => [profile.user_id, profile]),
  );

  const socialWorkerIds = new Set<string>();
  for (const link of carerLinks) {
    const profile = carerProfilesByUserId.get(link.user_id);
    const swId = profile?.social_worker_id || link.social_worker_id || null;
    if (swId) socialWorkerIds.add(swId);
  }

  const { data: socialWorkerProfiles, error: swError } =
    await listStaffProfilesByUserIds(
      supabase,
      [...socialWorkerIds],
      household.agency_id,
    );
  if (swError) return serviceFailure({ error: swError });

  const managerIds = [
    ...new Set(
      socialWorkerProfiles
        .map((profile) => profile.manager_id)
        .filter((id): id is string => !!id),
    ),
  ];

  const { data: managerProfiles, error: managersError } =
    await listStaffProfilesByUserIds(
      supabase,
      managerIds,
      household.agency_id,
    );
  if (managersError) return serviceFailure({ error: managersError });

  const staffProfilesByUserId = new Map(
    [...socialWorkerProfiles, ...managerProfiles].map((profile) => [
      profile.user_id,
      profile,
    ]),
  );

  const childIds = [
    ...new Set([
      ...childRows.map((row) => row.child_id),
      ...parentPlacements.map((row) => row.child_id),
    ]),
  ];
  const { data: children, error: childProfilesError } = await listChildrenByIds(
    supabase,
    childIds,
  );
  if (childProfilesError) return serviceFailure({ error: childProfilesError });

  const childrenById = new Map(
    children.map((child) => [
      child.id,
      {
        id: child.id,
        preferred_name: child.preferred_name,
        first_name: child.first_name,
        middle_name: child.middle_name,
        last_name: child.last_name,
        legal_name: child.legal_name,
        figapp_id: child.figapp_id,
      },
    ]),
  );

  const parentIds = [
    ...new Set(parentPlacements.map((row) => row.biological_parent_id)),
  ];
  const { data: parents, error: parentsError } =
    await listBiologicalParentsByIds(supabase, parentIds);
  if (parentsError) return serviceFailure({ error: parentsError });

  const parentsById = new Map(parents.map((parent) => [parent.id, parent]));

  const dto = toHouseholdDetailDto({
    household,
    carerLinks,
    childRows,
    parentPlacements,
    carerProfilesByUserId,
    staffProfilesByUserId,
    childrenById,
    parentsById,
    currentUserId: userId,
  });

  return serviceSuccess<HouseholdDetailDto>(dto);
}
