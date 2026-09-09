import { describe, expect, it } from "vitest";
import {
  expandRecurrence,
  isValidRecurrencePattern,
  MAX_RECURRENCE_OCCURRENCES,
  normalizeRecurrencePattern,
} from "../../src/lib/calendar-recurrence.js";

describe("expandRecurrence", () => {
  it("returns a single occurrence for a non-recurring event", () => {
    const result = expandRecurrence(
      "2026-09-10T09:00:00.000Z",
      "2026-09-10T10:00:00.000Z",
      null,
    );

    expect(result).toEqual([
      {
        occurrenceIndex: 1,
        startDatetime: "2026-09-10T09:00:00.000Z",
        endDatetime: "2026-09-10T10:00:00.000Z",
      },
    ]);
  });

  it("expands a weekly series until an end date, preserving duration", () => {
    const result = expandRecurrence(
      "2026-09-01T09:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
      {
        repeat: {
          every: 1,
          unit: "weeks",
          end: { type: "until", until: "2026-09-22T23:59:59.000Z" },
        },
      },
    );

    expect(result.map((o) => o.occurrenceIndex)).toEqual([1, 2, 3, 4]);
    expect(result[0].startDatetime).toBe("2026-09-01T09:00:00.000Z");
    expect(result[1].startDatetime).toBe("2026-09-08T09:00:00.000Z");
    expect(result[3].startDatetime).toBe("2026-09-22T09:00:00.000Z");
    for (const occurrence of result) {
      const durationMs =
        new Date(occurrence.endDatetime).getTime() -
        new Date(occurrence.startDatetime).getTime();
      expect(durationMs).toBe(60 * 60 * 1000);
    }
  });

  it("stops after the given occurrence count", () => {
    const result = expandRecurrence(
      "2026-09-01T09:00:00.000Z",
      "2026-09-01T10:00:00.000Z",
      {
        repeat: {
          every: 2,
          unit: "days",
          end: { type: "after", count: 3 },
        },
      },
    );

    expect(result).toHaveLength(3);
    expect(result[2].startDatetime).toBe("2026-09-05T09:00:00.000Z");
  });

  it("caps a never-ending series at MAX_RECURRENCE_OCCURRENCES", () => {
    const result = expandRecurrence(
      "2026-01-01T09:00:00.000Z",
      "2026-01-01T10:00:00.000Z",
      {
        repeat: { every: 1, unit: "days", end: { type: "never" } },
      },
    );

    expect(result).toHaveLength(MAX_RECURRENCE_OCCURRENCES);
  });

  it("advances by month across a year boundary", () => {
    const result = expandRecurrence(
      "2026-11-15T09:00:00.000Z",
      "2026-11-15T10:00:00.000Z",
      {
        repeat: { every: 1, unit: "months", end: { type: "after", count: 3 } },
      },
    );

    expect(result.map((o) => o.startDatetime)).toEqual([
      "2026-11-15T09:00:00.000Z",
      "2026-12-15T09:00:00.000Z",
      "2027-01-15T09:00:00.000Z",
    ]);
  });
});

describe("normalizeRecurrencePattern", () => {
  it("extends a date-only 'until' to end of that day", () => {
    const normalized = normalizeRecurrencePattern({
      repeat: { every: 1, unit: "weeks", end: { type: "until", until: "2026-09-22" } },
    });

    expect(normalized.repeat.end).toEqual({
      type: "until",
      until: "2026-09-22T23:59:59.999Z",
    });
  });

  it("leaves an already-timestamped 'until' and non-until ends unchanged", () => {
    const withTimestamp = normalizeRecurrencePattern({
      repeat: {
        every: 1,
        unit: "weeks",
        end: { type: "until", until: "2026-09-22T12:00:00.000Z" },
      },
    });
    expect(withTimestamp.repeat.end).toEqual({
      type: "until",
      until: "2026-09-22T12:00:00.000Z",
    });

    const never = normalizeRecurrencePattern({
      repeat: { every: 1, unit: "weeks", end: { type: "never" } },
    });
    expect(never.repeat.end).toEqual({ type: "never" });
  });
});

describe("isValidRecurrencePattern", () => {
  it("accepts a well-formed pattern for each end type", () => {
    expect(
      isValidRecurrencePattern({
        repeat: { every: 1, unit: "weeks", end: { type: "never" } },
      }),
    ).toBe(true);
    expect(
      isValidRecurrencePattern({
        repeat: { every: 2, unit: "days", end: { type: "after", count: 5 } },
      }),
    ).toBe(true);
    expect(
      isValidRecurrencePattern({
        repeat: {
          every: 1,
          unit: "months",
          end: { type: "until", until: "2026-12-31" },
        },
      }),
    ).toBe(true);
  });

  it("rejects malformed patterns", () => {
    expect(isValidRecurrencePattern(null)).toBe(false);
    expect(isValidRecurrencePattern({})).toBe(false);
    expect(
      isValidRecurrencePattern({ repeat: { every: 0, unit: "days", end: { type: "never" } } }),
    ).toBe(false);
    expect(
      isValidRecurrencePattern({
        repeat: { every: 1, unit: "fortnights", end: { type: "never" } },
      }),
    ).toBe(false);
    expect(
      isValidRecurrencePattern({
        repeat: { every: 1, unit: "days", end: { type: "after", count: 0 } },
      }),
    ).toBe(false);
    expect(
      isValidRecurrencePattern({
        repeat: { every: 1, unit: "days", end: { type: "until", until: "not-a-date" } },
      }),
    ).toBe(false);
  });
});
