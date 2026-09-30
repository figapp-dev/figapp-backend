import { describe, expect, it } from "vitest";
import { isActiveHousehold } from "../../src/lib/placement-status.js";

describe("isActiveHousehold", () => {
  it("treats a blank/unset status as active", () => {
    expect(isActiveHousehold({ status: null, is_active: true })).toBe(true);
    expect(isActiveHousehold({ status: "", is_active: true })).toBe(true);
  });

  it("treats status: 'active' (any case) as active", () => {
    expect(isActiveHousehold({ status: "active", is_active: true })).toBe(true);
    expect(isActiveHousehold({ status: "Active", is_active: true })).toBe(true);
  });

  it("is false when is_active is explicitly false, regardless of status", () => {
    expect(isActiveHousehold({ status: "active", is_active: false })).toBe(false);
  });

  it("is false for a non-active status like 'inactive' or 'closed'", () => {
    expect(isActiveHousehold({ status: "inactive", is_active: true })).toBe(false);
    expect(isActiveHousehold({ status: "closed", is_active: true })).toBe(false);
  });

  it("is false for a missing/undefined row", () => {
    expect(isActiveHousehold(undefined)).toBe(false);
  });
});
