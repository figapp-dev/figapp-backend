/**
 * Placement status helpers — matches figapp-new placementStatus.ts
 * (UK calendar dates via Europe/London).
 */

export type PlacementDisplayStatus = "Active" | "Scheduled" | "Ended";

/** Calendar date in UK as YYYY-MM-DD. */
export function getTodayUKDateString(onDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(onDate);
}

function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  return value.slice(0, 10);
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
