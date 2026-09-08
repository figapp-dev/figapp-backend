import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import {
  findChildLifeStoryData,
  updateChildLifeStoryData,
} from "../../repositories/life-story.js";
import { toLifeStoryEntryDto } from "../../mappers/life-story.js";
import { lifeStoryChildIdFromPath } from "../files/paths.js";
import { inferLifeStoryMediaType } from "./media-type.js";
import {
  isLifeStorySectionKey,
  lifeStorySectionLabel,
} from "../../types/life-story.js";
import type {
  AddLifeStoryEntryBody,
  LifeStoryEntryDto,
  LifeStoryEntryRow,
} from "../../types/life-story.js";

/** Same cap as web's addLeisurePhotosFromDailyLog.ts. */
const MAX_ENTRIES = 150;

export async function addLifeStoryEntryForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
  body: AddLifeStoryEntryBody,
): Promise<
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<LifeStoryEntryDto>>
> {
  const section = body.section?.trim();
  if (!section || !isLifeStorySectionKey(section)) {
    return serviceFailure({ badRequest: true });
  }

  // This endpoint is specifically for the daily-log "Add to Life Story"
  // photo flow (matches web's addLeisurePhotosFromDailyLog.ts) — an entry
  // always carries media. Notes-only Life Story contributions are a
  // separate, not-yet-built flow (see saveLifeStory.ts on web).
  const media = body.media;
  if (!media?.path?.trim() || !media.name?.trim()) {
    return serviceFailure({ badRequest: true });
  }

  const mediaPath = media.path.trim();
  if (lifeStoryChildIdFromPath(mediaPath) !== childId) {
    return serviceFailure({ forbidden: true });
  }

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

  const { data: lifeStoryData, error: loadError } =
    await findChildLifeStoryData(supabase, childId);
  if (loadError) {
    return serviceFailure({ error: loadError });
  }

  const existingEntries = Array.isArray(lifeStoryData?.lifestory_entries)
    ? lifeStoryData.lifestory_entries
    : [];

  const newEntry: LifeStoryEntryRow = {
    id: randomUUID(),
    section,
    section_label: lifeStorySectionLabel(section),
    notes: body.notes?.trim() ?? "",
    media_url: mediaPath,
    media_type: inferLifeStoryMediaType(media.name, media.contentType),
    media_name: media.name.trim(),
    created_at: new Date().toISOString(),
    created_by: userId,
  };

  const mergedEntries = [newEntry, ...existingEntries].slice(0, MAX_ENTRIES);

  const { error: updateError } = await updateChildLifeStoryData(supabase, childId, {
    ...(lifeStoryData ?? {}),
    lifestory_section_notes: lifeStoryData?.lifestory_section_notes ?? {},
    lifestory_entries: mergedEntries,
  });
  if (updateError) {
    return serviceFailure({ error: updateError });
  }

  return serviceSuccess(toLifeStoryEntryDto(newEntry));
}
