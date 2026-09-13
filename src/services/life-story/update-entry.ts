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
  LifeStoryEntryDto,
  LifeStoryEntryRow,
  UpdateLifeStoryEntryBody,
} from "../../types/life-story.js";

async function loadAccessibleEntries(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
) {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { error: householdError, forbidden: false, data: null };
  }

  const { allowed, error: accessError } = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (accessError) {
    return { error: accessError, forbidden: false, data: null };
  }
  if (!allowed) {
    return { error: null, forbidden: true, data: null };
  }

  const { data: lifeStoryData, error: loadError } =
    await findChildLifeStoryData(supabase, childId);
  if (loadError) {
    return { error: loadError, forbidden: false, data: null };
  }

  const entries = Array.isArray(lifeStoryData?.lifestory_entries)
    ? lifeStoryData.lifestory_entries
    : [];

  return {
    error: null,
    forbidden: false,
    data: { lifeStoryData: lifeStoryData ?? {}, entries },
  };
}

export async function updateLifeStoryEntryForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
  entryId: string,
  body: UpdateLifeStoryEntryBody,
) {
  const id = entryId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const loaded = await loadAccessibleEntries(supabase, userId, childId);
  if (loaded.error) return serviceFailure({ error: loaded.error });
  if (loaded.forbidden || !loaded.data) {
    return serviceFailure({ forbidden: true });
  }

  const { lifeStoryData, entries } = loaded.data;
  const index = entries.findIndex((entry) => entry.id === id);
  if (index < 0) return serviceFailure({ notFound: true });

  const existing = entries[index];
  if (existing.created_by !== userId) {
    return serviceFailure({ forbidden: true });
  }

  let section = existing.section;
  if (body.section !== undefined) {
    const next = body.section.trim();
    if (!isLifeStorySectionKey(next)) {
      return serviceFailure({ badRequest: true });
    }
    section = next;
  }

  const notes =
    body.notes !== undefined ? body.notes.trim() : (existing.notes ?? "");

  let mediaPath = existing.media_url;
  let mediaName = existing.media_name;
  let mediaType = existing.media_type;

  if (body.clearMedia === true) {
    mediaPath = null;
    mediaName = null;
    mediaType = "file";
  } else if (body.media?.path?.trim() && body.media?.name?.trim()) {
    mediaPath = body.media.path.trim();
    if (lifeStoryChildIdFromPath(mediaPath) !== childId) {
      return serviceFailure({ forbidden: true });
    }
    mediaName = body.media.name.trim();
    mediaType = inferLifeStoryMediaType(
      body.media.name,
      body.media.contentType,
    );
  }

  if (!mediaPath && !notes) {
    return serviceFailure({ badRequest: true });
  }

  const updated: LifeStoryEntryRow = {
    ...existing,
    section,
    section_label: lifeStorySectionLabel(section),
    notes,
    media_url: mediaPath,
    media_type: mediaType,
    media_name: mediaName,
  };

  const nextEntries = [...entries];
  nextEntries[index] = updated;

  const existingNotes = lifeStoryData.lifestory_section_notes ?? {};
  const nextSectionNotes: Partial<Record<LifeStorySectionKey, string>> = {
    ...existingNotes,
  };
  if (body.notes !== undefined) {
    nextSectionNotes[section] = notes;
  }

  const { error: updateError } = await updateChildLifeStoryData(
    supabase,
    childId,
    {
      ...lifeStoryData,
      lifestory_section_notes: nextSectionNotes,
      lifestory_entries: nextEntries,
    },
  );
  if (updateError) {
    return serviceFailure({ error: updateError });
  }

  return serviceSuccess<LifeStoryEntryDto>(toLifeStoryEntryDto(updated));
}

export async function deleteLifeStoryEntryForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
  entryId: string,
) {
  const id = entryId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const loaded = await loadAccessibleEntries(supabase, userId, childId);
  if (loaded.error) return serviceFailure({ error: loaded.error });
  if (loaded.forbidden || !loaded.data) {
    return serviceFailure({ forbidden: true });
  }

  const { lifeStoryData, entries } = loaded.data;
  const existing = entries.find((entry) => entry.id === id);
  if (!existing) return serviceFailure({ notFound: true });
  if (existing.created_by !== userId) {
    return serviceFailure({ forbidden: true });
  }

  const nextEntries = entries.filter((entry) => entry.id !== id);
  const { error: updateError } = await updateChildLifeStoryData(
    supabase,
    childId,
    {
      ...lifeStoryData,
      lifestory_entries: nextEntries,
    },
  );
  if (updateError) {
    return serviceFailure({ error: updateError });
  }

  return serviceSuccess({ ok: true as const });
}
