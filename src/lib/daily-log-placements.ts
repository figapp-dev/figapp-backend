import { toDateOnly } from "./dates.js";

export type ChildPlacementRow = {
  child_id: string | null;
  household_id: string | null;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

export type ParentPlacementRow = ChildPlacementRow & {
  biological_parent_id: string | null;
};

export type PlacementAssignmentLike = {
  assigned_date: string;
  assignment_subject: string | null;
  child_id: string | null;
  biological_parent_id: string | null;
  household_id: string | null;
};

/** Whether a placement row was active on a given calendar date. Matches
 * web's isPlacementActiveOnDate exactly. */
export function isPlacementActiveOnDate(
  placement: ChildPlacementRow | ParentPlacementRow | null | undefined,
  dateKey: string,
): boolean {
  if (!placement || placement.is_active === false) return false;

  const start = toDateOnly(placement.start_date);
  if (start && start > dateKey) return false;

  const end = toDateOnly(placement.end_date);
  if (end && end < dateKey) return false;

  return true;
}

function childKey(childId: string, householdId: string): string {
  return `${childId}:${householdId}`;
}

function parentKey(
  parentId: string,
  childId: string,
  householdId: string,
): string {
  return `${parentId}:${childId}:${householdId}`;
}

/**
 * Drop assignments whose child/placed-parent was not actively placed in
 * that household on the assignment's own assigned_date. Matches web's
 * filterAssignmentsToActivePlacements.
 *
 * daily_log_assignments has no end-of-placement cascade for past rows in
 * every code path that can end a placement, so a pending/overdue row for a
 * child (or placed parent) who has since left can linger indefinitely and
 * get shown to whoever is now linked to that household — this is the
 * read-time safety net web already relies on for exactly that reason, not
 * a substitute for keeping the underlying rows clean.
 */
export function filterAssignmentsToActivePlacements<
  T extends PlacementAssignmentLike,
>(
  assignments: T[],
  childPlacements: ChildPlacementRow[],
  parentPlacements: ParentPlacementRow[],
): T[] {
  const childIndex = new Map<string, ChildPlacementRow[]>();
  for (const row of childPlacements) {
    if (!row.child_id || !row.household_id) continue;
    const key = childKey(row.child_id, row.household_id);
    (childIndex.get(key) ?? childIndex.set(key, []).get(key)!).push(row);
  }

  const parentIndex = new Map<string, ParentPlacementRow[]>();
  for (const row of parentPlacements) {
    if (!row.biological_parent_id || !row.child_id || !row.household_id) {
      continue;
    }
    const key = parentKey(row.biological_parent_id, row.child_id, row.household_id);
    (parentIndex.get(key) ?? parentIndex.set(key, []).get(key)!).push(row);
  }

  return assignments.filter((assignment) => {
    const dateKey = toDateOnly(assignment.assigned_date);
    if (!dateKey) return false;

    const isParent =
      assignment.assignment_subject === "placed_parent" ||
      !!assignment.biological_parent_id;

    if (isParent) {
      if (
        !assignment.biological_parent_id ||
        !assignment.child_id ||
        !assignment.household_id
      ) {
        return false;
      }
      const key = parentKey(
        assignment.biological_parent_id,
        assignment.child_id,
        assignment.household_id,
      );
      const placements = parentIndex.get(key) ?? [];
      return placements.some((p) => isPlacementActiveOnDate(p, dateKey));
    }

    if (!assignment.child_id || !assignment.household_id) return false;
    const key = childKey(assignment.child_id, assignment.household_id);
    const placements = childIndex.get(key) ?? [];
    return placements.some((p) => isPlacementActiveOnDate(p, dateKey));
  });
}
