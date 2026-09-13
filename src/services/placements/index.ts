import type { SupabaseClient } from "@supabase/supabase-js";
import { getCarerHouseholdIds } from "../../lib/households.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  placementTypesMap,
  toChildPlacementListItemDto,
  toParentPlacementListItemDto,
  toPlacementDetailDto,
  toPlacementFosterCarers,
} from "../../mappers/placements.js";
import {
  listCarerDetailProfilesByUserIds,
  listCarersForHouseholds,
} from "../../repositories/households.js";
import {
  findChildPlacementById,
  findParentPlacementById,
  listAllChildPlacementsForHouseholds,
  listAllParentPlacementsForHouseholds,
  listPlacementChildrenByIds,
  listPlacementHouseholdsByIds,
  listPlacementParentsByIds,
  listPlacementTypesByIds,
} from "../../repositories/placements.js";
import type {
  PlacementDetailDto,
  PlacementFosterCarerDto,
  PlacementKind,
  PlacementListDto,
  PlacementListItemDto,
} from "../../types/placements.js";

function sortByStartDateDesc(a: PlacementListItemDto, b: PlacementListItemDto) {
  const aStart = a.startDate ?? "";
  const bStart = b.startDate ?? "";
  if (aStart === bStart) return a.id.localeCompare(b.id);
  return bStart.localeCompare(aStart);
}

async function loadFosterCarersForHousehold(
  supabase: SupabaseClient,
  householdId: string,
): Promise<{ data: PlacementFosterCarerDto[]; error: Error | null }> {
  const { data: carerLinks, error: carersError } = await listCarersForHouseholds(
    supabase,
    [householdId],
  );
  if (carersError) return { data: [], error: carersError };

  const userIds = [...new Set(carerLinks.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } =
    await listCarerDetailProfilesByUserIds(supabase, userIds);
  if (profilesError) return { data: [], error: profilesError };

  const profilesByUserId = new Map(
    profiles.map((profile) => [profile.user_id, profile]),
  );

  return {
    data: toPlacementFosterCarers({ carerLinks, profilesByUserId }),
    error: null,
  };
}

export async function listPlacementsForCarer(
  supabase: SupabaseClient,
  userId: string,
) {
  const { householdIds, error: idsError } = await getCarerHouseholdIds(
    supabase,
    userId,
  );
  if (idsError) return serviceFailure({ error: idsError });
  if (householdIds.length === 0) {
    return serviceSuccess<PlacementListDto>({ items: [] });
  }

  const [childPlacements, parentPlacements] = await Promise.all([
    listAllChildPlacementsForHouseholds(supabase, householdIds),
    listAllParentPlacementsForHouseholds(supabase, householdIds),
  ]);
  if (childPlacements.error) {
    return serviceFailure({ error: childPlacements.error });
  }
  if (parentPlacements.error) {
    return serviceFailure({ error: parentPlacements.error });
  }

  const childIds = [
    ...new Set([
      ...childPlacements.data.map((row) => row.child_id),
      ...parentPlacements.data.map((row) => row.child_id),
    ]),
  ];
  const parentIds = [
    ...new Set(parentPlacements.data.map((row) => row.biological_parent_id)),
  ];
  const allHouseholdIds = [
    ...new Set([
      ...childPlacements.data.map((row) => row.household_id),
      ...parentPlacements.data.map((row) => row.household_id),
    ]),
  ];

  const [children, parents, households] = await Promise.all([
    listPlacementChildrenByIds(supabase, childIds),
    listPlacementParentsByIds(supabase, parentIds),
    listPlacementHouseholdsByIds(supabase, allHouseholdIds),
  ]);
  if (children.error) return serviceFailure({ error: children.error });
  if (parents.error) return serviceFailure({ error: parents.error });
  if (households.error) return serviceFailure({ error: households.error });

  const childrenById = new Map(children.data.map((row) => [row.id, row]));
  const parentsById = new Map(parents.data.map((row) => [row.id, row]));
  const householdsById = new Map(households.data.map((row) => [row.id, row]));

  const typeIds = [
    ...new Set(children.data.flatMap((row) => row.placement_type_ids ?? [])),
  ];
  const types = await listPlacementTypesByIds(supabase, typeIds);
  if (types.error) return serviceFailure({ error: types.error });
  const typesById = placementTypesMap(types.data);

  const items: PlacementListItemDto[] = [
    ...childPlacements.data.map((row) =>
      toChildPlacementListItemDto({
        row,
        child: childrenById.get(row.child_id),
        household: householdsById.get(row.household_id),
        typesById,
      }),
    ),
    ...parentPlacements.data.map((row) =>
      toParentPlacementListItemDto({
        row,
        parent: parentsById.get(row.biological_parent_id),
        linkedChild: childrenById.get(row.child_id),
        household: householdsById.get(row.household_id),
      }),
    ),
  ].sort(sortByStartDateDesc);

  return serviceSuccess<PlacementListDto>({ items });
}

export async function getPlacementDetailForCarer(
  supabase: SupabaseClient,
  userId: string,
  placementId: string,
  kind: PlacementKind | string,
) {
  const id = placementId.trim();
  const normalizedKind = kind.trim();
  if (
    !id ||
    (normalizedKind !== "child" && normalizedKind !== "placed_parent")
  ) {
    return serviceFailure({ badRequest: true });
  }

  const { householdIds, error: idsError } = await getCarerHouseholdIds(
    supabase,
    userId,
  );
  if (idsError) return serviceFailure({ error: idsError });
  if (householdIds.length === 0) {
    return serviceFailure({ notFound: true });
  }

  if (normalizedKind === "child") {
    const { data: row, error } = await findChildPlacementById(supabase, id);
    if (error) return serviceFailure({ error });
    if (!row || !householdIds.includes(row.household_id)) {
      return serviceFailure({ notFound: true });
    }

    const [children, households] = await Promise.all([
      listPlacementChildrenByIds(supabase, [row.child_id]),
      listPlacementHouseholdsByIds(supabase, [row.household_id]),
    ]);
    if (children.error) return serviceFailure({ error: children.error });
    if (households.error) return serviceFailure({ error: households.error });

    const child = children.data[0];
    const typeIds = child?.placement_type_ids ?? [];
    const types = await listPlacementTypesByIds(supabase, typeIds);
    if (types.error) return serviceFailure({ error: types.error });

    const item = toChildPlacementListItemDto({
      row,
      child,
      household: households.data[0],
      typesById: placementTypesMap(types.data),
    });

    const carers = await loadFosterCarersForHousehold(
      supabase,
      row.household_id,
    );
    if (carers.error) return serviceFailure({ error: carers.error });

    return serviceSuccess<PlacementDetailDto>(
      toPlacementDetailDto(item, carers.data),
    );
  }

  const { data: row, error } = await findParentPlacementById(supabase, id);
  if (error) return serviceFailure({ error });
  if (!row || !householdIds.includes(row.household_id)) {
    return serviceFailure({ notFound: true });
  }

  const [parents, children, households] = await Promise.all([
    listPlacementParentsByIds(supabase, [row.biological_parent_id]),
    listPlacementChildrenByIds(supabase, [row.child_id]),
    listPlacementHouseholdsByIds(supabase, [row.household_id]),
  ]);
  if (parents.error) return serviceFailure({ error: parents.error });
  if (children.error) return serviceFailure({ error: children.error });
  if (households.error) return serviceFailure({ error: households.error });

  const item = toParentPlacementListItemDto({
    row,
    parent: parents.data[0],
    linkedChild: children.data[0],
    household: households.data[0],
  });

  const carers = await loadFosterCarersForHousehold(
    supabase,
    row.household_id,
  );
  if (carers.error) return serviceFailure({ error: carers.error });

  return serviceSuccess<PlacementDetailDto>(
    toPlacementDetailDto(item, carers.data),
  );
}
