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
  type LifeStorySectionKey,
} from "../../types/life-story.js";
import type {
  AddLifeStoryEntryBody,
  LifeStoryEntryDto,
  LifeStoryEntryRow,
} from "../../types/life-story.js";

/** Same cap as web's saveLifeStoryUpdates / addLeisurePhotosFromDailyLog. */
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

  const notes = body.notes?.trim() ?? "";
  const media = body.media;
  const hasMedia = Boolean(media?.path?.trim() && media?.name?.trim());

  // Web parity: create an entry when there is a new photo OR non-empty notes.
  if (!hasMedia && !notes) {
    return serviceFailure({ badRequest: true });
  }

  let mediaPath: string | null = null;
  let mediaName: string | null = null;
  let mediaType: LifeStoryEntryRow["media_type"] = "file";

  if (hasMedia && media) {
    mediaPath = media.path.trim();
    if (lifeStoryChildIdFromPath(mediaPath) !== childId) {
      return serviceFailure({ forbidden: true });
    }
    mediaName = media.name.trim();
    mediaType = inferLifeStoryMediaType(media.name, media.contentType);
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

  const existingNotes = lifeStoryData?.lifestory_section_notes ?? {};
  const nextSectionNotes: Partial<Record<LifeStorySectionKey, string>> = {
    ...existingNotes,
  };
  // Mirror web Add tab: when notes are included in the body, refresh the
  // section-notes seed. Media-only daily-log posts omit notes and leave
  // existing section notes untouched.
  if (body.notes !== undefined) {
    nextSectionNotes[section] = notes;
  }

  const newEntry: LifeStoryEntryRow = {
    id: randomUUID(),
    section,
    section_label: lifeStorySectionLabel(section),
    notes,
    media_url: mediaPath,
    media_type: mediaType,
    media_name: mediaName,
    created_at: new Date().toISOString(),
    created_by: userId,
  };

  const mergedEntries = [newEntry, ...existingEntries].slice(0, MAX_ENTRIES);

  const { error: updateError } = await updateChildLifeStoryData(supabase, childId, {
    ...(lifeStoryData ?? {}),
    lifestory_section_notes: nextSectionNotes,
    lifestory_entries: mergedEntries,
  });
  if (updateError) {
    return serviceFailure({ error: updateError });
  }

  return serviceSuccess(toLifeStoryEntryDto(newEntry));
}
