import { describe, expect, it } from "vitest";
import {
  DUNNING_SUSPEND_AFTER_DAYS,
  calendarDaysBetween,
  dunningNoticeEventId,
  dunningNoticeWeeksDue,
  planDunning,
  shouldSuspendForNonPayment,
} from "../../src/lib/billing-dunning.js";

describe("billing dunning", () => {
  it("counts calendar days between date-only strings", () => {
    expect(calendarDaysBetween("2026-08-01", "2026-08-01")).toBe(0);
    expect(calendarDaysBetween("2026-08-01", "2026-08-08")).toBe(7);
    expect(calendarDaysBetween("2026-08-01", "2026-08-30")).toBe(29);
  });

  it("sends weekly notices on days 7/14/21 and catch-up if cron is late", () => {
    expect(dunningNoticeWeeksDue(6)).toEqual([]);
    expect(dunningNoticeWeeksDue(7)).toEqual([1]);
    expect(dunningNoticeWeeksDue(13)).toEqual([1]);
    expect(dunningNoticeWeeksDue(14)).toEqual([1, 2]);
    expect(dunningNoticeWeeksDue(21)).toEqual([1, 2, 3]);
    expect(dunningNoticeWeeksDue(28)).toEqual([1, 2, 3]);
  });

  it("suspends on day 29", () => {
    expect(shouldSuspendForNonPayment(28)).toBe(false);
    expect(shouldSuspendForNonPayment(DUNNING_SUSPEND_AFTER_DAYS)).toBe(true);
    const plan = planDunning({
      pastDueSince: "2026-08-01",
      today: "2026-08-30",
    });
    expect(plan?.daysPastDue).toBe(29);
    expect(plan?.suspend).toBe(true);
    expect(plan?.noticeWeeks).toEqual([1, 2, 3]);
  });

  it("does not plan dunning without past_due_since", () => {
    expect(planDunning({ pastDueSince: null, today: "2026-08-30" })).toBeNull();
  });

  it("builds stable idempotency ids for notices", () => {
    expect(dunningNoticeEventId("ag-1", 2)).toBe("dunning-notice:ag-1:week-2");
  });
});
