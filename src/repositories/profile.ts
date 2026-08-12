import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type { ProfileRow } from "../types/profile.js";

const PROFILE_SELECT = `
  id,
  user_id,
  email,
  first_name,
  last_name,
  preferred_name,
  phone,
  role,
  position,
  job_title,
  date_of_birth,
  gender,
  figapp_id,
  status,
  is_active,
  agencies (
    id,
    name
  ),
  carer_households (
    id,
    name,
    address_line1,
    address_line2,
    city,
    postal_code,
    country
  )
`;

export async function findAgencyUserProfileByUserId(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ProfileRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select(PROFILE_SELECT)
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  return {
    data: (data as ProfileRow | null) ?? null,
    error,
  };
}
