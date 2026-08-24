import { toDateOnly } from "./dates.js";

/** Agency stays usable this many calendar days after the failed collection. */
export const DUNNING_GRACE_DAYS = 28;
/** Suspend when this many whole days have elapsed since `past_due_since`. */
export const DUNNING_SUSPEND_AFTER_DAYS = 29;
/** Weekly notices during grace (days 7, 14, 21). */
export const DUNNING_NOTICE_WEEKS = 3;

function utcDateOnlyMs(value: string): number | null {
  const key = toDateOnly(value);
  if (!key) return null;
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}

/** Whole calendar days from `from` to `to` (UTC date-only). Negative if `to` is earlier. */
export function calendarDaysBetween(from: string, to: string): number {
  const start = utcDateOnlyMs(from);
  const end = utcDateOnlyMs(to);
  if (start == null || end == null) return 0;
  return Math.floor((end - start) / 86_400_000);
}

export function daysPastDue(pastDueSince: string | null, today: string): number | null {
  const since = toDateOnly(pastDueSince);
  if (!since) return null;
  return calendarDaysBetween(since, today);
}

export function shouldSuspendForNonPayment(daysPastDueCount: number): boolean {
  return daysPastDueCount >= DUNNING_SUSPEND_AFTER_DAYS;
}

/**
 * Weekly reminder weeks that should already have been sent as of `daysPastDueCount`.
 * Week 1 = day 7, week 2 = day 14, week 3 = day 21. Catch-up if cron missed a day.
 */
export function dunningNoticeWeeksDue(daysPastDueCount: number): number[] {
  if (daysPastDueCount < 7) return [];
  const elapsed = Math.min(daysPastDueCount, DUNNING_GRACE_DAYS);
  const maxWeek = Math.min(DUNNING_NOTICE_WEEKS, Math.floor(elapsed / 7));
  return Array.from({ length: maxWeek }, (_, i) => i + 1);
}

export type DunningPlan = {
  daysPastDue: number;
  noticeWeeks: number[];
  suspend: boolean;
};

export function planDunning(params: {
  pastDueSince: string | null;
  today: string;
}): DunningPlan | null {
  const days = daysPastDue(params.pastDueSince, params.today);
  if (days == null || days < 0) return null;
  return {
    daysPastDue: days,
    noticeWeeks: dunningNoticeWeeksDue(days),
    suspend: shouldSuspendForNonPayment(days),
  };
}

export function dunningNoticeEventId(agencyId: string, week: number): string {
  return `dunning-notice:${agencyId}:week-${week}`;
}

export function dunningSuspendEventId(agencyId: string, pastDueSince: string): string {
  return `dunning-suspend:${agencyId}:${toDateOnly(pastDueSince) ?? pastDueSince}`;
}
