import { describe, expect, it } from "vitest";
import {
  OVERDUE_LOOKBACK_DAYS,
  resolveDailyLogsListQuery,
} from "../../../src/services/daily-logs/list-query.js";
import { addCalendarDays } from "../../../src/lib/dates.js";

describe("resolveDailyLogsListQuery", () => {
  const today = "2026-08-25";

  it("defaults to today when date and status are omitted", () => {
    expect(resolveDailyLogsListQuery({}, today)).toEqual({
      ok: true,
      kind: "date",
      assignedDate: today,
    });
  });

  it("uses a valid date query", () => {
    expect(
      resolveDailyLogsListQuery({ date: "2026-08-12T10:00:00.000Z" }, today),
    ).toEqual({
      ok: true,
      kind: "date",
      assignedDate: "2026-08-12",
    });
  });

  it("rejects an invalid date", () => {
    expect(resolveDailyLogsListQuery({ date: "25-08-2026" }, today)).toEqual({
      ok: false,
    });
  });

  it("resolves overdue to the lookback window before today", () => {
    expect(resolveDailyLogsListQuery({ status: "overdue" }, today)).toEqual({
      ok: true,
      kind: "overdue",
      afterDate: addCalendarDays(today, -OVERDUE_LOOKBACK_DAYS),
      beforeDate: today,
    });
  });

  it("rejects an unknown status", () => {
    expect(resolveDailyLogsListQuery({ status: "pending" }, today)).toEqual({
      ok: false,
    });
  });
});
