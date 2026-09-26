import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import { findChildLifeStoryData } from "../../repositories/life-story.js";
import { sortLifeStoryEntries, toLifeStoryEntryDto } from "../../mappers/life-story.js";
import {
  emptyLifeStorySectionNotes,
  type LifeStoryListDto,
  type LifeStorySectionKey,
} from "../../types/life-story.js";

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
    ...emptyLifeStorySectionNotes(),
    leisure_fun: rawNotes.leisure_fun?.trim() || "",
    academic_achievements: rawNotes.academic_achievements?.trim() || "",
    milestones: rawNotes.milestones?.trim() || "",
    other_events:
      rawNotes.other_events?.trim() ||
      rawNotes.other_achievements?.trim() ||
      "",
  };

  return serviceSuccess<LifeStoryListDto>({
    childId,
    entries: entries.map(toLifeStoryEntryDto),
    sectionNotes,
  });
}
