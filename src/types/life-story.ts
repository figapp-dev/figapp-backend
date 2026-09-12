/** Mirrors web's modules/children/lifestory/constants.ts — same three
 * sections, same keys, since this app writes into the same shared
 * children.life_story_data jsonb column. */
export const LIFE_STORY_SECTIONS = [
  { key: "leisure_fun", label: "Leisure & Fun" },
  { key: "academic_achievements", label: "Academic Achievements" },
  { key: "other_achievements", label: "Other Achievements" },
] as const;

export type LifeStorySectionKey = (typeof LIFE_STORY_SECTIONS)[number]["key"];

export function isLifeStorySectionKey(
  value: unknown,
): value is LifeStorySectionKey {
  return LIFE_STORY_SECTIONS.some((section) => section.key === value);
}

export function lifeStorySectionLabel(key: LifeStorySectionKey): string {
  return LIFE_STORY_SECTIONS.find((section) => section.key === key)!.label;
}

export type LifeStoryMediaType = "photo" | "video" | "file";

/** Shape stored inside children.life_story_data.lifestory_entries — same
 * field names web writes/reads, so entries created from either app show up
 * correctly in both. */
export type LifeStoryEntryRow = {
  id: string;
  section: LifeStorySectionKey;
  section_label: string;
  notes: string;
  media_url: string | null;
  media_type: LifeStoryMediaType;
  media_name: string | null;
  created_at: string;
  created_by: string;
};

export type LifeStoryData = {
  lifestory_section_notes?: Partial<Record<LifeStorySectionKey, string>>;
  lifestory_entries?: LifeStoryEntryRow[];
  [key: string]: unknown;
};

export type LifeStoryEntryDto = {
  id: string;
  section: LifeStorySectionKey;
  sectionLabel: string;
  notes: string;
  mediaPath: string | null;
  mediaType: LifeStoryMediaType;
  mediaName: string | null;
  createdAt: string;
  createdBy: string;
};

export type LifeStoryListDto = {
  childId: string;
  entries: LifeStoryEntryDto[];
  sectionNotes: Record<LifeStorySectionKey, string>;
};

/** Media is optional — notes-only entries match web saveLifeStoryUpdates.
 * When media is present, `path` must come from POST /files/signed-upload-url
 * with resource "life_story" for this same child. */
export type AddLifeStoryEntryBody = {
  section: string;
  notes?: string;
  media?: {
    path: string;
    name: string;
    contentType?: string;
  };
};
