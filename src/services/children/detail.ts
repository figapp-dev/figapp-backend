import type { SupabaseClient } from "@supabase/supabase-js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { isBiologicalParentUnder18 } from "../../lib/age.js";
import type { ChildrenDetailDto } from "../../types/children.js";
import {
  toChildDetailDto,
  toLinkedChildSummaryDto,
  toPlacedParentDetailDto,
} from "../../mappers/children.js";
import {
  findActiveBiologicalParentPlacement,
  findBiologicalParentById,
  findChildById,
  findCurrentPlacementForChild,
  findLinkedChildSummary,
  findParentChildPlacementTypeId,
  loadChildCareDetails,
} from "../../repositories/children.js";
import { assertChildAccessibleToCarer } from "./shared.js";

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
  const { data: parentChildTypeId, error: typeError } =
    await findParentChildPlacementTypeId(supabase);
  if (typeError) {
    return { data: null, error: typeError };
  }

  const { data: child, error: childError } = await findChildById(
    supabase,
    childId,
  );

  if (childError) {
    return { data: null, error: childError };
  }
  if (!child) {
    return { data: null, error: null };
  }

  const careDetailsResult = await loadChildCareDetails(supabase, childId);
  if (careDetailsResult.error) {
    return { data: null, error: careDetailsResult.error };
  }

  const { data: placement, error: placementError } =
    await findCurrentPlacementForChild(supabase, childId, householdIds);
  if (placementError) {
    return { data: null, error: placementError };
  }

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

async function loadPlacedParentDetail(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: ChildrenDetailDto | null; error: Error | null }> {
  if (householdIds.length === 0) {
    return { data: null, error: null };
  }

  const { data: placement, error: placementError } =
    await findActiveBiologicalParentPlacement(
      supabase,
      parentId,
      householdIds,
    );

  if (placementError) {
    return { data: null, error: placementError };
  }
  if (!placement) {
    return { data: null, error: null };
  }

  const { data: parent, error: parentError } = await findBiologicalParentById(
    supabase,
    parentId,
  );

  if (parentError) {
    return { data: null, error: parentError };
  }
  if (!parent) {
    return { data: null, error: null };
  }

  if (!isBiologicalParentUnder18(parent.date_of_birth)) {
    // Match list behaviour: only under-18 placed parents are exposed.
    return { data: null, error: null };
  }

  const { data: linkedChildRow, error: linkedChildError } =
    await findLinkedChildSummary(supabase, placement.child_id);

  if (linkedChildError) {
    return { data: null, error: linkedChildError };
  }

  const linkedChild = linkedChildRow
    ? toLinkedChildSummaryDto(linkedChildRow)
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
