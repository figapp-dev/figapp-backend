import { describe, expect, it } from "vitest";
import {
  checkDateRange,
  checkFilters,
  coerceBoolean,
  resolveListColumns,
} from "../../../src/services/admin-chat/query-validator.js";
import { findTableDef } from "../../../src/services/admin-chat/schema-catalog.js";

const agencyUsers = findTableDef("agency_users")!;
const dailyLogAssignments = findTableDef("admin_chat_daily_log_assignments_named")!;
const childrenPlacementStatus = findTableDef(
  "admin_chat_children_placement_status",
)!;

describe("checkFilters", () => {
  it("allows a filter on an allowlisted column", () => {
    expect(checkFilters(agencyUsers, { role: "agency_admin" })).toBeNull();
  });

  it("rejects a column not in the table's filterable list", () => {
    expect(checkFilters(agencyUsers, { email: "x@example.com" })).toContain(
      'Column "email" is not filterable',
    );
  });

  it("rejects agency_id as a model-supplied filter (it is forced separately, never model-controlled)", () => {
    expect(checkFilters(agencyUsers, { agency_id: "some-other-agency" })).toContain(
      'Column "agency_id" is not filterable',
    );
  });
});

describe("resolveListColumns", () => {
  it("defaults to the first 6 catalog columns when none are requested", () => {
    const result = resolveListColumns(agencyUsers, undefined);
    expect("columns" in result).toBe(true);
    if ("columns" in result) {
      expect(result.columns).toEqual(agencyUsers.columns.slice(0, 6));
    }
  });

  it("accepts requested columns that are all exposed", () => {
    const result = resolveListColumns(agencyUsers, ["id", "role"]);
    expect(result).toEqual({ columns: ["id", "role"] });
  });

  it("rejects a column the table does not expose", () => {
    const result = resolveListColumns(agencyUsers, ["id", "date_of_birth"]);
    expect("error" in result).toBe(true);
    if ("error" in result) {
      expect(result.error).toContain('Column "date_of_birth" is not exposed');
    }
  });
});

describe("checkDateRange", () => {
  it("allows no date_range at all", () => {
    expect(checkDateRange(dailyLogAssignments, undefined)).toBeNull();
  });

  it("allows a valid range on an allowlisted date-range column ('last week')", () => {
    expect(
      checkDateRange(dailyLogAssignments, {
        column: "assigned_date",
        from: "2026-09-20",
        to: "2026-09-26",
      }),
    ).toBeNull();
  });

  it("rejects a column that isn't a date-range column on that table", () => {
    expect(
      checkDateRange(dailyLogAssignments, {
        column: "status",
        from: "2026-09-20",
        to: "2026-09-26",
      }),
    ).toContain('Column "status" is not a date-range column');
  });

  it("rejects malformed dates", () => {
    expect(
      checkDateRange(dailyLogAssignments, {
        column: "assigned_date",
        from: "20 Sept 2026",
        to: "2026-09-26",
      }),
    ).toContain("must be YYYY-MM-DD");
  });

  it("rejects from being after to", () => {
    expect(
      checkDateRange(dailyLogAssignments, {
        column: "assigned_date",
        from: "2026-09-26",
        to: "2026-09-20",
      }),
    ).toContain("must not be after");
  });
});

describe("coerceBoolean", () => {
  it("passes a real boolean through unchanged", () => {
    expect(coerceBoolean(true)).toBe(true);
    expect(coerceBoolean(false)).toBe(false);
  });

  it("parses the strings 'true'/'false' case-insensitively", () => {
    expect(coerceBoolean("true")).toBe(true);
    expect(coerceBoolean("TRUE")).toBe(true);
    expect(coerceBoolean("false")).toBe(false);
  });

  it("does not let an arbitrary non-empty string fall back to JS truthiness", () => {
    expect(coerceBoolean("yes")).toBe(false);
  });
});

describe("admin_chat_children_placement_status catalog entry", () => {
  it("allows filtering by is_placed and status", () => {
    expect(
      checkFilters(childrenPlacementStatus, { is_placed: false }),
    ).toBeNull();
    expect(
      checkFilters(childrenPlacementStatus, { status: "active" }),
    ).toBeNull();
  });

  it("rejects a column it doesn't expose as filterable", () => {
    expect(
      checkFilters(childrenPlacementStatus, { date_of_birth: "2010-01-01" }),
    ).toContain('Column "date_of_birth" is not filterable');
  });
});
