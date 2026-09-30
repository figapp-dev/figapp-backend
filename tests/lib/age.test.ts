import { describe, expect, it } from "vitest";
import { isPortalEligibleChildAge } from "../../src/lib/age.js";

describe("isPortalEligibleChildAge", () => {
  const onDate = new Date("2026-09-30T00:00:00Z");

  it("is false for a child under 13", () => {
    expect(isPortalEligibleChildAge("2014-06-01", onDate)).toBe(false);
  });

  it("is true for a child exactly 13 (birthday already passed this year)", () => {
    expect(isPortalEligibleChildAge("2013-06-01", onDate)).toBe(true);
  });

  it("is false when the 13th birthday hasn't occurred yet this year", () => {
    expect(isPortalEligibleChildAge("2013-12-20", onDate)).toBe(false);
  });

  it("is true for a child older than 13", () => {
    expect(isPortalEligibleChildAge("2010-01-01", onDate)).toBe(true);
  });

  it("is false when date of birth is missing", () => {
    expect(isPortalEligibleChildAge(null, onDate)).toBe(false);
    expect(isPortalEligibleChildAge(undefined, onDate)).toBe(false);
  });
});
