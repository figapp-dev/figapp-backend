import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  PlacementChildRow,
  PlacementChildSummaryRow,
  PlacementParentRow,
  PlacementTypeRow,
} from "../types/placements.js";
import type { BiologicalParentRow } from "../types/children.js";
import type { HouseholdRow } from "../types/households.js";

export async function listAllChildPlacementsForHouseholds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: PlacementChildRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select(
      "id, household_id, child_id, start_date, end_date, is_active, notes",
    )
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  return {
    data: ((data as PlacementChildRow[] | null) ?? []),
    error,
  };
}

export async function listAllParentPlacementsForHouseholds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: PlacementParentRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(
      "id, household_id, child_id, biological_parent_id, start_date, end_date, is_active",
    )
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  return {
    data: ((data as PlacementParentRow[] | null) ?? []),
    error,
  };
}

export async function findChildPlacementById(
  supabase: SupabaseClient,
  placementId: string,
): Promise<{ data: PlacementChildRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select(
      "id, household_id, child_id, start_date, end_date, is_active, notes",
    )
    .eq("id", placementId)
    .maybeSingle();

  return {
    data: (data as PlacementChildRow | null) ?? null,
    error,
  };
}

export async function findParentPlacementById(
  supabase: SupabaseClient,
  placementId: string,
): Promise<{ data: PlacementParentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(
      "id, household_id, child_id, biological_parent_id, start_date, end_date, is_active",
    )
    .eq("id", placementId)
    .maybeSingle();

  return {
    data: (data as PlacementParentRow | null) ?? null,
    error,
  };
}

export async function listPlacementChildrenByIds(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ data: PlacementChildSummaryRow[]; error: Error | null }> {
  if (childIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(
      "id, legal_name, preferred_name, first_name, middle_name, last_name, date_of_birth, figapp_id, placement_type_ids",
    )
    .in("id", childIds);

  return {
    data: ((data as PlacementChildSummaryRow[] | null) ?? []),
    error,
  };
}

export async function listPlacementTypesByIds(
  supabase: SupabaseClient,
  typeIds: string[],
): Promise<{ data: PlacementTypeRow[]; error: Error | null }> {
  if (typeIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.PLACEMENT_TYPES)
    .select("id, name")
    .in("id", typeIds);

  return {
    data: ((data as PlacementTypeRow[] | null) ?? []),
    error,
  };
}

export async function listPlacementHouseholdsByIds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: HouseholdRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.CARER_HOUSEHOLDS)
    .select(
      "id, household_id_system, agency_id, name, status, max_children, address_line1, address_line2, city, postal_code, country, created_at",
    )
    .in("id", householdIds);

  return {
    data: ((data as HouseholdRow[] | null) ?? []),
    error,
  };
}

export async function listPlacementParentsByIds(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<{ data: BiologicalParentRow[]; error: Error | null }> {
  if (parentIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, name, date_of_birth, figapp_id, relationship, phone, email")
    .in("id", parentIds);

  return {
    data: ((data as BiologicalParentRow[] | null) ?? []),
    error,
  };
}
