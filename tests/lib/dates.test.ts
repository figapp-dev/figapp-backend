import { describe, expect, it, vi, afterEach } from "vitest";
import {
  getTodayUKDateString,
  timestampsMatch,
  toDateOnly,
} from "../../src/lib/dates.js";

describe("toDateOnly", () => {
  it("normalizes valid date prefixes", () => {
    expect(toDateOnly("2026-08-12")).toBe("2026-08-12");
    expect(toDateOnly("2026-08-12T10:00:00.000Z")).toBe("2026-08-12");
  });

  it("rejects invalid values", () => {
    expect(toDateOnly(null)).toBeNull();
    expect(toDateOnly("")).toBeNull();
    expect(toDateOnly("12-08-2026")).toBeNull();
    expect(toDateOnly("not-a-date")).toBeNull();
  });
});

describe("getTodayUKDateString", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("formats Europe/London calendar date", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-11T23:30:00Z"));
    // 00:30 BST on 12 Aug → UK date is 2026-08-12
    expect(getTodayUKDateString()).toBe("2026-08-12");
  });
});

describe("timestampsMatch", () => {
  it("treats missing expected as match (caller must require lock separately)", () => {
    expect(timestampsMatch(undefined, "2026-08-11T10:00:00.000Z")).toBe(true);
    expect(timestampsMatch("", "2026-08-11T10:00:00.000Z")).toBe(true);
  });

  it("matches equal ISO timestamps", () => {
    const ts = "2026-08-11T10:00:00.000Z";
    expect(timestampsMatch(ts, ts)).toBe(true);
  });

  it("detects mismatch", () => {
    expect(
      timestampsMatch(
        "2026-08-11T10:00:00.000Z",
        "2026-08-11T11:00:00.000Z",
      ),
    ).toBe(false);
  });
});
