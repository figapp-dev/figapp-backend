import { describe, expect, it } from "vitest";
import {
  checkFilters,
  resolveListColumns,
} from "../../../src/services/admin-chat/query-validator.js";
import { findTableDef } from "../../../src/services/admin-chat/schema-catalog.js";

const agencyUsers = findTableDef("agency_users")!;

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
