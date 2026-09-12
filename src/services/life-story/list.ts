import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import { findChildLifeStoryData } from "../../repositories/life-story.js";
import { sortLifeStoryEntries, toLifeStoryEntryDto } from "../../mappers/life-story.js";
import type {
  LifeStoryListDto,
  LifeStorySectionKey,
} from "../../types/life-story.js";

const EMPTY_SECTION_NOTES: Record<LifeStorySectionKey, string> = {
  leisure_fun: "",
  academic_achievements: "",
  other_achievements: "",
};

export async function listLifeStoryForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
): Promise<
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<LifeStoryListDto>>
> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return serviceFailure({ error: householdError });
  }

  const { allowed, error: accessError } = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (accessError) {
    return serviceFailure({ error: accessError });
  }
  if (!allowed) {
    return serviceFailure({ forbidden: true });
  }

  const { data, error } = await findChildLifeStoryData(supabase, childId);
  if (error) {
    return serviceFailure({ error });
  }

  const entries = Array.isArray(data?.lifestory_entries)
    ? sortLifeStoryEntries(data.lifestory_entries)
    : [];

  const rawNotes = data?.lifestory_section_notes ?? {};
  const sectionNotes: Record<LifeStorySectionKey, string> = {
    leisure_fun: rawNotes.leisure_fun?.trim() || "",
    academic_achievements: rawNotes.academic_achievements?.trim() || "",
    other_achievements: rawNotes.other_achievements?.trim() || "",
  };

  return serviceSuccess<LifeStoryListDto>({
    childId,
    entries: entries.map(toLifeStoryEntryDto),
    sectionNotes: { ...EMPTY_SECTION_NOTES, ...sectionNotes },
  });
}
