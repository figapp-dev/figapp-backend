/**
 * Placement status helpers — matches figapp-new placementStatus.ts
 * (UK calendar dates via Europe/London).
 */

import { getTodayUKDateString, toDateOnly } from "./dates.js";

export type PlacementDisplayStatus = "Active" | "Scheduled" | "Ended";

/**
 * Whether a household_children placement row counts as currently placed.
 * Matches web isCurrentlyActivePlacement.
 */
export function isCurrentlyActivePlacement(placement?: {
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean | null;
}): boolean {
  if (!placement || placement.is_active !== true) return false;

  const today = getTodayUKDateString();
  const start = toDateOnly(placement.start_date);
  const end = toDateOnly(placement.end_date);

  if (start && start > today) return false;
  if (end && end < today) return false;

  return true;
}

/**
 * Whether a household_carers link is active for today (UK dates).
 * Matches web isActiveHouseholdLinkForToday.
 */
export function isActiveHouseholdLinkForToday(row?: {
  household_id?: string | null;
  is_active?: boolean | null;
  start_date?: string | null;
  end_date?: string | null;
}): boolean {
  if (!row?.household_id) return false;
  if (row.is_active === false) return false;

  const today = getTodayUKDateString();
  const start = toDateOnly(row.start_date);
  const end = toDateOnly(row.end_date);

  if (start && start > today) return false;
  if (end && end < today) return false;

  return true;
}

/**
 * UI status for a placement row. Uses UK dates and is_active.
 * Same rules as web getPlacementDisplayStatus.
 */
export function getPlacementDisplayStatus(placement?: {
  start_date?: string | null;
  end_date?: string | null;
  is_active?: boolean | null;
}): PlacementDisplayStatus | null {
  if (!placement?.start_date) return null;

  const today = getTodayUKDateString();
  const start = toDateOnly(placement.start_date);
  const end = toDateOnly(placement.end_date);

  if (start && start > today) return "Scheduled";
  if (end && end < today) return "Ended";
  if (placement.is_active === false) return "Ended";

  return "Active";
}
