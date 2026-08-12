import type { SupabaseClient } from "@supabase/supabase-js";
import { toProfileDto } from "../mappers/profile.js";
import { findAgencyUserProfileByUserId } from "../repositories/profile.js";
import type { ProfileDto } from "../types/profile.js";

export async function getProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: ProfileDto | null; error: Error | null }> {
  const { data, error } = await findAgencyUserProfileByUserId(supabase, userId);
  if (error) {
    return { data: null, error };
  }
  if (!data) {
    return { data: null, error: null };
  }
  return { data: toProfileDto(data), error: null };
}
