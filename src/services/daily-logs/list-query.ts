import { addCalendarDays, getTodayUKDateString, toDateOnly } from "../../lib/dates.js";

export const OVERDUE_LOOKBACK_DAYS = 90;
export const OVERDUE_LIST_LIMIT = 50;

export type DailyLogsListOptions = {
  date?: string;
  status?: string;
};

export type ResolvedDailyLogsList =
  | { ok: true; kind: "date"; assignedDate: string }
  | { ok: true; kind: "overdue"; afterDate: string; beforeDate: string }
  | { ok: false };

export function resolveDailyLogsListQuery(
  options?: DailyLogsListOptions,
  today = getTodayUKDateString(),
): ResolvedDailyLogsList {
  const status = options?.status != null ? String(options.status).trim().toLowerCase() : "";
  if (status !== "") {
    if (status !== "overdue") return { ok: false };
    const afterDate = addCalendarDays(today, -OVERDUE_LOOKBACK_DAYS);
    if (!afterDate) return { ok: false };
    return {
      ok: true,
      kind: "overdue",
      afterDate,
      beforeDate: today,
    };
  }

  if (options?.date != null && String(options.date).trim() !== "") {
    const parsed = toDateOnly(options.date);
    if (!parsed) return { ok: false };
    return { ok: true, kind: "date", assignedDate: parsed };
  }

  return { ok: true, kind: "date", assignedDate: today };
}
