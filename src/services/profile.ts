import { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type { ProfileRow } from "../types/profile.js";

export async function getProfile(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select(
      `
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
    `,
    )
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  return {
    data: data as ProfileRow | null,
    error,
  };
}
