import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import { isBiologicalParentUnder18 } from "../lib/age.js";
import type {
  AllergyRow,
  BiologicalParentRow,
  ChildDetailRow,
  ChildListRow,
  ChildrenDetailDto,
  ChildrenListDto,
  ChildrenListItemDto,
  ContactRow,
  CurrentPlacementRow,
  HouseholdChildRow,
  MedicalConditionRow,
  PlacementsDto,
} from "../types/children.js";
import {
  toChildDetailDto,
  toChildListItemDto,
  toLinkedChildSummaryDto,
  toPlacedParentDetailDto,
  toPlacedParentListItemDto,
  toPlacementHistoryItemDto,
} from "../mappers/children.js";

const PARENT_CHILD_PLACEMENT_TYPE_CODE = "parent_child";

const CHILD_LIST_SELECT = `
  id,
  legal_name,
  preferred_name,
  first_name,
  middle_name,
  last_name,
  date_of_birth,
  gender_identity,
  gender_identity_description,
  pronouns,
  figapp_id,
  status,
  placement_type_ids
`;

const CURRENT_PLACEMENT_SELECT = `
  id,
  start_date,
  end_date,
  carer_households:household_id (
    id,
    name,
    address_line1,
    address_line2,
    city,
    postal_code,
    country
  )
`;

const PARENT_PLACEMENT_SELECT = `
  id,
  child_id,
  start_date,
  end_date,
  is_active,
  carer_households:household_id (
    id,
    name,
    address_line1,
    address_line2,
    city,
    postal_code,
    country
  )
`;

const PLACEMENT_HISTORY_SELECT = `
  id,
  child_id,
  start_date,
  end_date,
  is_active,
  carer_households:household_id (
    id,
    name,
    address_line1,
    address_line2,
    city,
    postal_code,
    country
  )
`;

const PARENT_DETAIL_SELECT = `
  id,
  name,
  date_of_birth,
  figapp_id,
  relationship,
  phone,
  email
`;

const LINKED_CHILD_SELECT = `
  id,
  legal_name,
  preferred_name,
  first_name,
  middle_name,
  last_name,
  figapp_id
`;

type ParentPlacementFlatRow = {
  id: string;
  child_id: string;
  household_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  biological_parent_id: string;
};

type ActiveChildPlacements = {
  childIds: string[];
  placedSinceByChild: Map<string, string | null>;
};

async function getActiveHouseholdIds(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ householdIds: string[]; error: Error | null }> {
  const { data: householdLinks, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) {
    return { householdIds: [], error };
  }

  const householdIds = (householdLinks ?? [])
    .map((row) => row.household_id as string)
    .filter(Boolean);

  return { householdIds, error: null };
}

async function getParentChildPlacementTypeId(
  supabase: SupabaseClient,
): Promise<{ parentChildTypeId: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.PLACEMENT_TYPES)
    .select("id")
    .eq("code", PARENT_CHILD_PLACEMENT_TYPE_CODE)
    .maybeSingle();

  if (error) {
    return { parentChildTypeId: null, error };
  }

  return {
    parentChildTypeId: (data?.id as string | undefined) ?? null,
    error: null,
  };
}

async function getActiveChildPlacements(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ placements: ActiveChildPlacements; error: Error | null }> {
  const empty: ActiveChildPlacements = {
    childIds: [],
    placedSinceByChild: new Map(),
  };

  const { data: placementRows, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("id, child_id, start_date, is_active, end_date")
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds);

  if (error) {
    return { placements: empty, error };
  }

  const activePlacements = (placementRows ?? []) as HouseholdChildRow[];
  const childIds = [...new Set(activePlacements.map((row) => row.child_id))];

  const placedSinceByChild = new Map<string, string | null>();
  for (const row of activePlacements) {
    if (!placedSinceByChild.has(row.child_id)) {
      placedSinceByChild.set(row.child_id, row.start_date);
    }
  }

  return { placements: { childIds, placedSinceByChild }, error: null };
}

async function buildChildItems(
  supabase: SupabaseClient,
  placements: ActiveChildPlacements,
  parentChildTypeId: string | null,
): Promise<{ items: ChildrenListItemDto[]; error: Error | null }> {
  const { childIds, placedSinceByChild } = placements;

  if (childIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: childRows, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(CHILD_LIST_SELECT)
    .in("id", childIds);

  if (error) {
    return { items: [], error };
  }

  const items = ((childRows ?? []) as ChildListRow[]).map((child) => {
    const isParentChildPlacement = parentChildTypeId
      ? (child.placement_type_ids ?? []).includes(parentChildTypeId)
      : false;

    return toChildListItemDto(
      child,
      placedSinceByChild.get(child.id) ?? null,
      isParentChildPlacement,
    );
  });

  return { items, error: null };
}

async function buildPlacedParentItems(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ items: ChildrenListItemDto[]; error: Error | null }> {
  if (childIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: parentPlacementRows, error: parentPlacementError } =
    await supabase
      .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
      .select(
        "id, child_id, household_id, start_date, end_date, is_active, biological_parent_id",
      )
      .eq("is_active", true)
      .in("child_id", childIds);

  if (parentPlacementError) {
    return { items: [], error: parentPlacementError };
  }

  const activeParentPlacements = (
    (parentPlacementRows ?? []) as ParentPlacementFlatRow[]
  ).filter((row) => !row.end_date && row.biological_parent_id);

  const parentIds = [
    ...new Set(activeParentPlacements.map((row) => row.biological_parent_id)),
  ];

  if (parentIds.length === 0) {
    return { items: [], error: null };
  }

  const { data: parentRows, error: parentsError } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, name, date_of_birth, figapp_id, relationship")
    .in("id", parentIds);

  if (parentsError) {
    return { items: [], error: parentsError };
  }

  const parentsById = new Map(
    ((parentRows ?? []) as BiologicalParentRow[]).map((parent) => [
      parent.id,
      parent,
    ]),
  );

  const items: ChildrenListItemDto[] = [];
  const seenParents = new Set<string>();

  for (const row of activeParentPlacements) {
    const parent = parentsById.get(row.biological_parent_id);
    if (!parent?.id) continue;
    if (!isBiologicalParentUnder18(parent.date_of_birth)) continue;

    const key = `${parent.id}:${row.child_id}`;
    if (seenParents.has(key)) continue;
    seenParents.add(key);

    items.push(
      toPlacedParentListItemDto(parent, row.child_id, row.start_date),
    );
  }

  return { items, error: null };
}

function mergeAndSortItems(
  childItems: ChildrenListItemDto[],
  parentItems: ChildrenListItemDto[],
): ChildrenListItemDto[] {
  return [...childItems, ...parentItems].sort((a, b) =>
    a.displayName.localeCompare(b.displayName),
  );
}

async function assertChildAccessibleToCarer(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ allowed: boolean; error: Error | null }> {
  if (householdIds.length === 0) {
    return { allowed: false, error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("id")
    .eq("child_id", childId)
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { allowed: false, error };
  }

  return { allowed: !!data, error: null };
}

/** Any placement (active or ended) in the carer's households. */
async function assertChildHasPlacementInCarerHouseholds(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ allowed: boolean; error: Error | null }> {
  if (householdIds.length === 0) {
    return { allowed: false, error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("id")
    .eq("child_id", childId)
    .in("household_id", householdIds)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { allowed: false, error };
  }

  return { allowed: !!data, error: null };
}

async function loadChildCareDetails(
  supabase: SupabaseClient,
  childId: string,
): Promise<{
  allergies: AllergyRow[];
  medicalConditions: MedicalConditionRow[];
  emergencyContacts: ContactRow[];
  professionalContacts: ContactRow[];
  error: Error | null;
}> {
  const empty = {
    allergies: [] as AllergyRow[],
    medicalConditions: [] as MedicalConditionRow[],
    emergencyContacts: [] as ContactRow[],
    professionalContacts: [] as ContactRow[],
  };

  const [
    allergiesResult,
    medicalResult,
    emergencyResult,
    professionalResult,
  ] = await Promise.all([
    supabase
      .from(TABLES.CHILD_ALLERGIES)
      .select("id, allergy")
      .eq("child_id", childId),
    supabase
      .from(TABLES.CHILD_MEDICAL_CONDITIONS)
      .select("id, condition")
      .eq("child_id", childId),
    supabase
      .from(TABLES.CHILD_EMERGENCY_CONTACTS)
      .select("id, name, phone, email, relationship")
      .eq("child_id", childId),
    supabase
      .from(TABLES.CHILD_PROFESSIONAL_CONTACTS)
      .select("id, name, phone, email, relationship")
      .eq("child_id", childId),
  ]);

  const firstError =
    allergiesResult.error ||
    medicalResult.error ||
    emergencyResult.error ||
    professionalResult.error;

  if (firstError) {
    return { ...empty, error: firstError };
  }

  return {
    allergies: (allergiesResult.data ?? []) as AllergyRow[],
    medicalConditions: (medicalResult.data ?? []) as MedicalConditionRow[],
    emergencyContacts: (emergencyResult.data ?? []) as ContactRow[],
    professionalContacts: (professionalResult.data ?? []) as ContactRow[],
    error: null,
  };
}

async function loadCurrentPlacementForChild(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ placement: CurrentPlacementRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select(CURRENT_PLACEMENT_SELECT)
    .eq("child_id", childId)
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { placement: null, error };
  }

  return {
    placement: (data as CurrentPlacementRow | null) ?? null,
    error: null,
  };
}

export async function listChildrenForCarer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ChildrenListDto | null; error: Error | null }> {
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

  const { parentChildTypeId, error: typeError } =
    await getParentChildPlacementTypeId(supabase);
  if (typeError) {
    return { data: null, error: typeError };
  }

  const { placements, error: placementError } = await getActiveChildPlacements(
    supabase,
    householdIds,
  );
  if (placementError) {
    return { data: null, error: placementError };
  }

  const { items: childItems, error: childrenError } = await buildChildItems(
    supabase,
    placements,
    parentChildTypeId,
  );
  if (childrenError) {
    return { data: null, error: childrenError };
  }

  const { items: parentItems, error: parentsError } =
    await buildPlacedParentItems(supabase, placements.childIds);
  if (parentsError) {
    return { data: null, error: parentsError };
  }

  return {
    data: { items: mergeAndSortItems(childItems, parentItems) },
    error: null,
  };
}

export async function getChildForCarer(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ data: ChildrenDetailDto | null; error: Error | null }> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }

  const { allowed: childAllowed, error: childAccessError } =
    await assertChildAccessibleToCarer(supabase, id, householdIds);
  if (childAccessError) {
    return { data: null, error: childAccessError };
  }

  if (childAllowed) {
    return loadChildDetail(supabase, id, householdIds);
  }

  return loadPlacedParentDetail(supabase, id, householdIds);
}

async function loadChildDetail(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: ChildrenDetailDto | null; error: Error | null }> {
  const { parentChildTypeId, error: typeError } =
    await getParentChildPlacementTypeId(supabase);
  if (typeError) {
    return { data: null, error: typeError };
  }

  const { data: childRow, error: childError } = await supabase
    .from(TABLES.CHILDREN)
    .select(CHILD_LIST_SELECT)
    .eq("id", childId)
    .maybeSingle();

  if (childError) {
    return { data: null, error: childError };
  }
  if (!childRow) {
    return { data: null, error: null };
  }

  const careDetailsResult = await loadChildCareDetails(supabase, childId);
  if (careDetailsResult.error) {
    return { data: null, error: careDetailsResult.error };
  }

  const { placement, error: placementError } =
    await loadCurrentPlacementForChild(supabase, childId, householdIds);
  if (placementError) {
    return { data: null, error: placementError };
  }

  const child = childRow as ChildDetailRow;
  const isParentChildPlacement = parentChildTypeId
    ? (child.placement_type_ids ?? []).includes(parentChildTypeId)
    : false;

  return {
    data: toChildDetailDto(
      child,
      isParentChildPlacement,
      careDetailsResult.allergies,
      careDetailsResult.medicalConditions,
      careDetailsResult.emergencyContacts,
      careDetailsResult.professionalContacts,
      placement,
    ),
    error: null,
  };
}

type ParentPlacementDetailRow = CurrentPlacementRow & {
  child_id: string;
};

async function loadPlacedParentDetail(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: ChildrenDetailDto | null; error: Error | null }> {
  if (householdIds.length === 0) {
    return { data: null, error: null };
  }

  const { data: placementRow, error: placementError } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(PARENT_PLACEMENT_SELECT)
    .eq("biological_parent_id", parentId)
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (placementError) {
    return { data: null, error: placementError };
  }
  if (!placementRow) {
    return { data: null, error: null };
  }

  const placement = placementRow as ParentPlacementDetailRow;

  const { data: parentRow, error: parentError } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select(PARENT_DETAIL_SELECT)
    .eq("id", parentId)
    .maybeSingle();

  if (parentError) {
    return { data: null, error: parentError };
  }
  if (!parentRow) {
    return { data: null, error: null };
  }

  const parent = parentRow as BiologicalParentRow;
  if (!isBiologicalParentUnder18(parent.date_of_birth)) {
    // Match list behaviour: only under-18 placed parents are exposed.
    return { data: null, error: null };
  }

  const { data: linkedChildRow, error: linkedChildError } = await supabase
    .from(TABLES.CHILDREN)
    .select(LINKED_CHILD_SELECT)
    .eq("id", placement.child_id)
    .maybeSingle();

  if (linkedChildError) {
    return { data: null, error: linkedChildError };
  }

  const linkedChild = linkedChildRow
    ? toLinkedChildSummaryDto(linkedChildRow as ChildListRow)
    : null;

  return {
    data: toPlacedParentDetailDto(
      parent,
      placement.child_id,
      linkedChild,
      placement,
    ),
    error: null,
  };
}

async function loadChildPlacementHistory(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  const { allowed, error: accessError } =
    await assertChildHasPlacementInCarerHouseholds(
      supabase,
      childId,
      householdIds,
    );
  if (accessError) {
    return { data: null, error: accessError };
  }
  if (!allowed) {
    return { data: null, error: null };
  }

  const { data: rows, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select(PLACEMENT_HISTORY_SELECT)
    .eq("child_id", childId)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  return {
    data: {
      kind: "child",
      id: childId,
      items: ((rows ?? []) as CurrentPlacementRow[]).map(
        toPlacementHistoryItemDto,
      ),
    },
    error: null,
  };
}

async function loadPlacedParentPlacementHistory(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  if (householdIds.length === 0) {
    return { data: null, error: null };
  }

  const { data: rows, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(PLACEMENT_HISTORY_SELECT)
    .eq("biological_parent_id", parentId)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  if (error) {
    return { data: null, error };
  }

  const placements = (rows ?? []) as CurrentPlacementRow[];
  if (placements.length === 0) {
    return { data: null, error: null };
  }

  const { data: parentRow, error: parentError } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, date_of_birth")
    .eq("id", parentId)
    .maybeSingle();

  if (parentError) {
    return { data: null, error: parentError };
  }
  if (!parentRow || !isBiologicalParentUnder18(parentRow.date_of_birth)) {
    return { data: null, error: null };
  }

  return {
    data: {
      kind: "placed_parent",
      id: parentId,
      items: placements.map(toPlacementHistoryItemDto),
    },
    error: null,
  };
}

export async function listPlacementsForCarer(
  supabase: SupabaseClient,
  userId: string,
  id: string,
): Promise<{ data: PlacementsDto | null; error: Error | null }> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { data: null, error: householdError };
  }

  const childResult = await loadChildPlacementHistory(
    supabase,
    id,
    householdIds,
  );
  if (childResult.error) {
    return childResult;
  }
  if (childResult.data) {
    return childResult;
  }

  return loadPlacedParentPlacementHistory(supabase, id, householdIds);
}
