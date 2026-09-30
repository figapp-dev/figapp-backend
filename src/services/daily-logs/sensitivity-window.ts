import { getTodayUKDateString, toDateOnly } from "../../lib/dates.js";

/** Whole calendar days from one YYYY-MM-DD key to another (UTC date parts, no timezone shift). */
function calendarDaysBetween(fromKey: string, toKey: string): number {
  const [fy, fm, fd] = fromKey.split("-").map(Number);
  const [ty, tm, td] = toKey.split("-").map(Number);
  const fromUtc = Date.UTC(fy, fm - 1, fd);
  const toUtc = Date.UTC(ty, tm - 1, td);
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

/**
 * Whether a social_worker/sw_manager may toggle "Mark as Sensitive" on a
 * caseload member's log right now. Matches web's canEditDailyLogSensitivity
 * for the SW/SWM branch (src/utils/dailyLogSensitivity.ts): always allowed
 * before completion; within 7 calendar days after completion; never after.
 */
export function canToggleDailyLogSensitivity(options: {
  isCompleted: boolean;
  completedAtIso: string | null | undefined;
  now?: Date;
}): boolean {
  if (!options.isCompleted) return true;

  const completedDateKey = toDateOnly(options.completedAtIso ?? null);
  if (!completedDateKey) return false;

  const todayKey = getTodayUKDateString(options.now ?? new Date());
  return calendarDaysBetween(completedDateKey, todayKey) <= 7;
}
