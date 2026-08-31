import { getTodayUKDateString, toDateOnly } from "../../lib/dates.js";

export type DailyLogsListOptions = {
  date?: string;
  status?: string;
};

export type ResolvedDailyLogsList =
  | { ok: true; kind: "date"; assignedDate: string }
  | { ok: true; kind: "overdue"; beforeDate: string }
  | { ok: true; kind: "completed" }
  | { ok: false };

export function resolveDailyLogsListQuery(
  options?: DailyLogsListOptions,
  today = getTodayUKDateString(),
): ResolvedDailyLogsList {
  const status = options?.status != null ? String(options.status).trim().toLowerCase() : "";
  if (status !== "") {
    if (status === "overdue") {
      return { ok: true, kind: "overdue", beforeDate: today };
    }
    if (status === "completed") {
      return { ok: true, kind: "completed" };
    }
    return { ok: false };
  }

  if (options?.date != null && String(options.date).trim() !== "") {
    const parsed = toDateOnly(options.date);
    if (!parsed) return { ok: false };
    return { ok: true, kind: "date", assignedDate: parsed };
  }

  return { ok: true, kind: "date", assignedDate: today };
}
