import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  HouseholdCarerRow,
  HouseholdChildRow,
  HouseholdRow,
} from "../types/households.js";

export async function listHouseholdsByIds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: HouseholdRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.CARER_HOUSEHOLDS)
    .select(
      "id, household_id_system, name, status, max_children, address_line1, address_line2, city, postal_code, country",
    )
    .in("id", householdIds)
    .order("name", { ascending: true });

  return {
    data: ((data as HouseholdRow[] | null) ?? []),
    error,
  };
}

export async function listCarersForHouseholds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: HouseholdCarerRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CARERS)
    .select("household_id, user_id, is_active, start_date, end_date")
    .in("household_id", householdIds);

  return {
    data: ((data as HouseholdCarerRow[] | null) ?? []),
    error,
  };
}

export async function listChildrenForHouseholds(
  supabase: SupabaseClient,
  householdIds: string[],
): Promise<{ data: HouseholdChildRow[]; error: Error | null }> {
  if (householdIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("household_id, child_id, is_active, start_date, end_date")
    .in("household_id", householdIds);

  return {
    data: ((data as HouseholdChildRow[] | null) ?? []),
    error,
  };
}

export async function listFosterCarerProfilesByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<{
  data: Array<{
    user_id: string;
    first_name: string | null;
    last_name: string | null;
    preferred_name: string | null;
    figapp_id: string | null;
    role: string | null;
  }>;
  error: Error | null;
}> {
  if (userIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id, first_name, last_name, preferred_name, figapp_id, role")
    .in("user_id", userIds)
    .eq("role", "foster_carer")
    .eq("is_archived", false);

  return {
    data: (data as Array<{
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      figapp_id: string | null;
      role: string | null;
    }> | null) ?? [],
    error,
  };
}
