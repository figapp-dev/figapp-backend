import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type { LifeStoryData } from "../types/life-story.js";

export async function findChildLifeStoryData(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ data: LifeStoryData | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select("life_story_data")
    .eq("id", childId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as { life_story_data?: LifeStoryData } | null)
      ?.life_story_data ?? null,
    error: null,
  };
}

export async function updateChildLifeStoryData(
  supabase: SupabaseClient,
  childId: string,
  lifeStoryData: LifeStoryData,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.CHILDREN)
    .update({ life_story_data: lifeStoryData })
    .eq("id", childId);

  return { error };
}
