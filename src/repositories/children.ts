import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  AllergyRow,
  BiologicalParentRow,
  ChildDetailRow,
  ChildListRow,
  ContactRow,
  CurrentPlacementRow,
  HouseholdChildRow,
  MedicalConditionRow,
} from "../types/children.js";

const PARENT_CHILD_PLACEMENT_TYPE_CODE = "parent_child";

export const CHILD_LIST_SELECT = `
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

export const CURRENT_PLACEMENT_SELECT = `
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

export const PARENT_PLACEMENT_SELECT = `
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

export const PLACEMENT_HISTORY_SELECT = `
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

export const PARENT_DETAIL_SELECT = `
  id,
  name,
  date_of_birth,
  figapp_id,
  relationship,
  phone,
  email
`;

export const LINKED_CHILD_SELECT = `
  id,
  legal_name,
  preferred_name,
  first_name,
  middle_name,
  last_name,
  figapp_id
`;

export type ParentPlacementFlatRow = {
  id: string;
  child_id: string;
  household_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  biological_parent_id: string;
};

export type ParentPlacementDetailRow = CurrentPlacementRow & {
  child_id: string;
};

export type BiologicalParentDobRow = {
  id: string;
  date_of_birth: string | null;
};

export async function findParentChildPlacementTypeId(
  supabase: SupabaseClient,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.PLACEMENT_TYPES)
    .select("id")
    .eq("code", PARENT_CHILD_PLACEMENT_TYPE_CODE)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data?.id as string | undefined) ?? null,
    error: null,
  };
}

export async function listActiveHouseholdChildPlacements(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: HouseholdChildRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("id, child_id, start_date, is_active, end_date")
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as HouseholdChildRow[], error: null };
}

export async function listChildrenByIds(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ data: ChildListRow[]; error: Error | null }> {
  if (childIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(CHILD_LIST_SELECT)
    .in("id", childIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as ChildListRow[], error: null };
}

export async function listActiveBiologicalParentPlacementsByChildIds(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ data: ParentPlacementFlatRow[]; error: Error | null }> {
  if (childIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(
      "id, child_id, household_id, start_date, end_date, is_active, biological_parent_id",
    )
    .eq("is_active", true)
    .in("child_id", childIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as ParentPlacementFlatRow[], error: null };
}

export async function listBiologicalParentsByIds(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<{ data: BiologicalParentRow[]; error: Error | null }> {
  if (parentIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, name, date_of_birth, figapp_id, relationship")
    .in("id", parentIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as BiologicalParentRow[], error: null };
}

export async function findActiveChildPlacementAccess(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: { id: string } | null; error: Error | null }> {
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
    return { data: null, error };
  }

  return { data: (data as { id: string } | null) ?? null, error: null };
}

/** Any placement (active or ended) in the given households. */
export async function findAnyChildPlacementAccess(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: { id: string } | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("id")
    .eq("child_id", childId)
    .in("household_id", householdIds)
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return { data: (data as { id: string } | null) ?? null, error: null };
}

export async function loadChildCareDetails(
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

export async function findCurrentPlacementForChild(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: CurrentPlacementRow | null; error: Error | null }> {
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
    return { data: null, error };
  }

  return {
    data: (data as CurrentPlacementRow | null) ?? null,
    error: null,
  };
}

export async function findChildById(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ data: ChildDetailRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(CHILD_LIST_SELECT)
    .eq("id", childId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as ChildDetailRow | null) ?? null,
    error: null,
  };
}

export async function findActiveBiologicalParentPlacement(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: ParentPlacementDetailRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(PARENT_PLACEMENT_SELECT)
    .eq("biological_parent_id", parentId)
    .eq("is_active", true)
    .is("end_date", null)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as ParentPlacementDetailRow | null) ?? null,
    error: null,
  };
}

export async function findBiologicalParentById(
  supabase: SupabaseClient,
  parentId: string,
): Promise<{ data: BiologicalParentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select(PARENT_DETAIL_SELECT)
    .eq("id", parentId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as BiologicalParentRow | null) ?? null,
    error: null,
  };
}

export async function findLinkedChildSummary(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ data: ChildListRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(LINKED_CHILD_SELECT)
    .eq("id", childId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as ChildListRow | null) ?? null,
    error: null,
  };
}

export async function listChildPlacementHistory(
  supabase: SupabaseClient,
  childId: string,
  householdIds: string[],
): Promise<{ data: CurrentPlacementRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select(PLACEMENT_HISTORY_SELECT)
    .eq("child_id", childId)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as CurrentPlacementRow[], error: null };
}

export async function listBiologicalParentPlacementHistory(
  supabase: SupabaseClient,
  parentId: string,
  householdIds: string[],
): Promise<{ data: CurrentPlacementRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.BIOLOGICAL_PARENT_PLACEMENTS)
    .select(PLACEMENT_HISTORY_SELECT)
    .eq("biological_parent_id", parentId)
    .in("household_id", householdIds)
    .order("start_date", { ascending: false });

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as CurrentPlacementRow[], error: null };
}

export async function findBiologicalParentDob(
  supabase: SupabaseClient,
  parentId: string,
): Promise<{ data: BiologicalParentDobRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, date_of_birth")
    .eq("id", parentId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as BiologicalParentDobRow | null) ?? null,
    error: null,
  };
}
