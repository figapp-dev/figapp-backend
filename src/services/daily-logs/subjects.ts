import type { SupabaseClient } from "@supabase/supabase-js";
import { buildChildDisplayName } from "../../lib/child-names.js";
import { educationArrangementFromLifeStory } from "../../mappers/children.js";
import {
  findChildLifeStoryData,
  listBiologicalParentNameRows,
  listChildrenNameRows,
} from "../../repositories/daily-logs.js";
import type { DailyLogAssignmentListRow } from "../../types/daily-logs.js";

export async function loadSubjectNames(
  supabase: SupabaseClient,
  rows: DailyLogAssignmentListRow[],
): Promise<{
  childNames: Map<string, string>;
  parentNames: Map<string, string>;
  error: Error | null;
}> {
  const childIds = [
    ...new Set(rows.map((row) => row.child_id).filter(Boolean)),
  ] as string[];
  const parentIds = [
    ...new Set(rows.map((row) => row.biological_parent_id).filter(Boolean)),
  ] as string[];

  const childNames = new Map<string, string>();
  const parentNames = new Map<string, string>();

  const [childrenResult, parentsResult] = await Promise.all([
    listChildrenNameRows(supabase, childIds),
    listBiologicalParentNameRows(supabase, parentIds),
  ]);

  if (childrenResult.error) {
    return { childNames, parentNames, error: childrenResult.error };
  }
  if (parentsResult.error) {
    return { childNames, parentNames, error: parentsResult.error };
  }

  for (const child of childrenResult.data) {
    childNames.set(child.id, buildChildDisplayName(child));
  }

  for (const parent of parentsResult.data) {
    parentNames.set(parent.id, parent.name?.trim() || "Parent");
  }

  return { childNames, parentNames, error: null };
}

export function resolveSubjectName(
  row: DailyLogAssignmentListRow,
  childNames: Map<string, string>,
  parentNames: Map<string, string>,
): string | null {
  const isParent =
    row.assignment_subject === "placed_parent" || !!row.biological_parent_id;

  if (isParent && row.biological_parent_id) {
    return parentNames.get(row.biological_parent_id) ?? null;
  }

  if (row.child_id) {
    return childNames.get(row.child_id) ?? null;
  }

  return null;
}

/** Best-effort: a failure here must not block opening the log. */
export async function loadEducationArrangement(
  supabase: SupabaseClient,
  childId: string | null,
): Promise<string | null> {
  if (!childId) return null;
  const { data, error } = await findChildLifeStoryData(supabase, childId);
  if (error) return null;
  return educationArrangementFromLifeStory(data);
}
