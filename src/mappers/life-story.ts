import type {
  LifeStoryEntryDto,
  LifeStoryEntryRow,
} from "../types/life-story.js";

export function toLifeStoryEntryDto(row: LifeStoryEntryRow): LifeStoryEntryDto {
  return {
    id: row.id,
    section: row.section,
    sectionLabel: row.section_label,
    notes: row.notes,
    mediaPath: row.media_url,
    mediaType: row.media_type,
    mediaName: row.media_name,
    createdAt: row.created_at,
    createdBy: row.created_by,
  };
}

/** Newest first — same order web shows them in. */
export function sortLifeStoryEntries(
  entries: LifeStoryEntryRow[],
): LifeStoryEntryRow[] {
  return [...entries].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}
