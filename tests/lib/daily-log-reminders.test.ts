import { describe, expect, it } from "vitest";
import {
  countOverdueAssignments,
  ukIsoWeekPeriodKey,
  ukMonthPeriodKey,
} from "../../src/services/daily-logs/reminders.js";

describe("daily log reminder helpers", () => {
  it("counts only past incomplete assignments as overdue", () => {
    expect(
      countOverdueAssignments([
        { assigned_date: "2000-01-01", status: "pending" },
        { assigned_date: "2000-01-02", status: "in_progress" },
        { assigned_date: "2000-01-03", status: "completed" },
        { assigned_date: "2099-01-01", status: "pending" },
        { assigned_date: null, status: "pending" },
      ]),
    ).toBe(2);
  });

  it("formats UK ISO week and month keys", () => {
    // Fixed UTC instant → stable Europe/London calendar day.
    const midweek = new Date("2026-03-18T12:00:00.000Z");
    expect(ukMonthPeriodKey(midweek)).toBe("2026-03");
    expect(ukIsoWeekPeriodKey(midweek)).toMatch(/^2026-W\d{2}$/);
  });
});
