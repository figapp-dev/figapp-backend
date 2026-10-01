import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../../lib/tables.js";

export type ChildPlacementStatusRow = {
  id: string;
  child_name: string;
  status: string;
  date_of_birth: string | null;
  is_placed: boolean;
};

/**
 * One row per non-archived child in the agency, with whether they currently
 * have an active household_children placement. household_children has no
 * row at all for a child who's never been placed, so this is a small JS
 * join (fetch the agency's children, fetch active placements for just
 * those child ids, mark membership) rather than a single passthrough query
 * — see the comment on this table's schema-catalog entry for why.
 */
export async function fetchChildrenPlacementStatus(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: ChildPlacementStatusRow[]; error: Error | null }> {
  const { data: childRows, error: childError } = await supabase
    .from(TABLES.CHILDREN)
    .select("id, legal_name, preferred_name, status, date_of_birth")
    .eq("agency_id", agencyId)
    .neq("status", "archived");

  if (childError) return { data: [], error: childError };

  const rows = (childRows ?? []) as Array<{
    id: string;
    legal_name: string | null;
    preferred_name: string | null;
    status: string | null;
    date_of_birth: string | null;
  }>;
  if (rows.length === 0) return { data: [], error: null };

  const childIds = rows.map((row) => row.id);

  const { data: placementRows, error: placementError } = await supabase
    .from(TABLES.HOUSEHOLD_CHILDREN)
    .select("child_id")
    .in("child_id", childIds)
    .eq("is_active", true);

  if (placementError) return { data: [], error: placementError };

  const placedChildIds = new Set(
    ((placementRows ?? []) as Array<{ child_id: string }>).map(
      (row) => row.child_id,
    ),
  );

  const data: ChildPlacementStatusRow[] = rows.map((row) => ({
    id: row.id,
    child_name:
      row.preferred_name?.trim() || row.legal_name?.trim() || "Unnamed child",
    status: row.status ?? "active",
    date_of_birth: row.date_of_birth,
    is_placed: placedChildIds.has(row.id),
  }));

  return { data, error: null };
}
