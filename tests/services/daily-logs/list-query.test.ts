import { describe, expect, it } from "vitest";
import { resolveDailyLogsListQuery } from "../../../src/services/daily-logs/list-query.js";

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

  it("resolves overdue to all incomplete assignments before today", () => {
    expect(resolveDailyLogsListQuery({ status: "overdue" }, today)).toEqual({
      ok: true,
      kind: "overdue",
      beforeDate: today,
    });
  });

  it("rejects an unknown status", () => {
    expect(resolveDailyLogsListQuery({ status: "pending" }, today)).toEqual({
      ok: false,
    });
  });
});
