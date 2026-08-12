import { afterEach, describe, expect, it, vi } from "vitest";
import {
  isDailyLogEditable,
  isDailyLogOverdue,
  isCompletedOrSubmitted,
} from "../../src/lib/daily-log-status.js";

describe("isCompletedOrSubmitted", () => {
  it("detects completed and submitted", () => {
    expect(isCompletedOrSubmitted("completed")).toBe(true);
    expect(isCompletedOrSubmitted("Submitted")).toBe(true);
    expect(isCompletedOrSubmitted("in_progress")).toBe(false);
  });
});

describe("isDailyLogEditable / isDailyLogOverdue", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps incomplete logs editable and overdue only after assigned day", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));

    expect(
      isDailyLogEditable({
        assignedDate: "2026-08-10",
        logStatus: "in_progress",
        assignmentStatus: "in_progress",
      }),
    ).toBe(true);

    expect(
      isDailyLogOverdue({
        assignedDate: "2026-08-10",
        logStatus: "in_progress",
        assignmentStatus: "in_progress",
      }),
    ).toBe(true);

    expect(
      isDailyLogOverdue({
        assignedDate: "2026-08-11",
        logStatus: "pending",
        assignmentStatus: "pending",
      }),
    ).toBe(false);
  });

  it("allows same-day edits of completed logs only", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T12:00:00Z"));

    expect(
      isDailyLogEditable({
        assignedDate: "2026-08-11",
        logStatus: "completed",
        assignmentStatus: "completed",
      }),
    ).toBe(true);

    expect(
      isDailyLogEditable({
        assignedDate: "2026-08-10",
        logStatus: "completed",
        assignmentStatus: "completed",
      }),
    ).toBe(false);

    expect(
      isDailyLogOverdue({
        assignedDate: "2026-08-10",
        logStatus: "completed",
        assignmentStatus: "completed",
      }),
    ).toBe(false);
  });
});
