import { describe, expect, it } from "vitest";
import { canToggleDailyLogSensitivity } from "../../../src/services/daily-logs/sensitivity-window.js";

describe("canToggleDailyLogSensitivity", () => {
  const now = new Date("2026-09-29T12:00:00.000Z");

  it("is always allowed before completion, regardless of completedAtIso", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: false,
        completedAtIso: null,
        now,
      }),
    ).toBe(true);
  });

  it("is not allowed once completed with no completedAtIso recorded", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: true,
        completedAtIso: null,
        now,
      }),
    ).toBe(false);
  });

  it("is allowed exactly on the completion day", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: true,
        completedAtIso: "2026-09-29T08:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("is allowed exactly 7 calendar days after completion", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: true,
        completedAtIso: "2026-09-22T08:00:00.000Z",
        now,
      }),
    ).toBe(true);
  });

  it("is not allowed on the 8th calendar day after completion", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: true,
        completedAtIso: "2026-09-21T08:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });

  it("is not allowed long after completion", () => {
    expect(
      canToggleDailyLogSensitivity({
        isCompleted: true,
        completedAtIso: "2026-01-01T08:00:00.000Z",
        now,
      }),
    ).toBe(false);
  });
});
