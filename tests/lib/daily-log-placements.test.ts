import { describe, expect, it } from "vitest";
import {
  filterAssignmentsToActivePlacements,
  isPlacementActiveOnDate,
  type ChildPlacementRow,
  type ParentPlacementRow,
} from "../../src/lib/daily-log-placements.js";

describe("isPlacementActiveOnDate", () => {
  it("is inactive once is_active is explicitly false, regardless of dates", () => {
    expect(
      isPlacementActiveOnDate(
        { child_id: "c1", household_id: "h1", is_active: false, start_date: "2026-01-01", end_date: null },
        "2026-06-01",
      ),
    ).toBe(false);
  });

  it("is inactive before its start_date", () => {
    expect(
      isPlacementActiveOnDate(
        { child_id: "c1", household_id: "h1", is_active: true, start_date: "2026-08-01", end_date: null },
        "2026-07-31",
      ),
    ).toBe(false);
  });

  it("is inactive after its end_date", () => {
    expect(
      isPlacementActiveOnDate(
        { child_id: "c1", household_id: "h1", is_active: false, start_date: "2026-08-16", end_date: "2026-08-22" },
        "2026-08-23",
      ),
    ).toBe(false);
  });

  it("is active on its start_date and end_date (inclusive)", () => {
    const placement: ChildPlacementRow = {
      child_id: "c1",
      household_id: "h1",
      is_active: true,
      start_date: "2026-08-16",
      end_date: "2026-08-22",
    };
    expect(isPlacementActiveOnDate(placement, "2026-08-16")).toBe(true);
    expect(isPlacementActiveOnDate(placement, "2026-08-22")).toBe(true);
  });

  it("is active with no end_date once started", () => {
    expect(
      isPlacementActiveOnDate(
        { child_id: "c1", household_id: "h1", is_active: true, start_date: "2026-01-01", end_date: null },
        "2027-01-01",
      ),
    ).toBe(true);
  });
});

describe("filterAssignmentsToActivePlacements", () => {
  // Regression: a foster carer's mobile app kept showing a pending/overdue
  // daily log for a placed biological parent whose placement had ended
  // weeks earlier — nothing in the placement-ending code path reliably
  // deletes every already-past pending row, so it lingered and was shown
  // to the household's next-assigned carer. Web already guards against
  // this at read time; the backend serving mobile did not.
  it("drops a child assignment once that placement has ended", () => {
    const childPlacements: ChildPlacementRow[] = [
      {
        child_id: "child-1",
        household_id: "house-1",
        is_active: false,
        start_date: "2026-08-01",
        end_date: "2026-08-22",
      },
    ];

    const result = filterAssignmentsToActivePlacements(
      [
        {
          assigned_date: "2026-08-23",
          assignment_subject: "child",
          child_id: "child-1",
          biological_parent_id: null,
          household_id: "house-1",
        },
      ],
      childPlacements,
      [],
    );

    expect(result).toEqual([]);
  });

  it("keeps a child assignment while the placement is still active", () => {
    const childPlacements: ChildPlacementRow[] = [
      {
        child_id: "child-1",
        household_id: "house-1",
        is_active: true,
        start_date: "2026-08-01",
        end_date: null,
      },
    ];

    const assignment = {
      assigned_date: "2026-08-23",
      assignment_subject: "child",
      child_id: "child-1",
      biological_parent_id: null,
      household_id: "house-1",
    };

    expect(
      filterAssignmentsToActivePlacements([assignment], childPlacements, []),
    ).toEqual([assignment]);
  });

  it("drops a placed-parent assignment once that placement has ended", () => {
    const parentPlacements: ParentPlacementRow[] = [
      {
        biological_parent_id: "parent-1",
        child_id: "child-1",
        household_id: "house-1",
        is_active: false,
        start_date: "2026-08-16",
        end_date: "2026-08-22",
      },
    ];

    const result = filterAssignmentsToActivePlacements(
      [
        {
          assigned_date: "2026-08-23",
          assignment_subject: "placed_parent",
          child_id: "child-1",
          biological_parent_id: "parent-1",
          household_id: "house-1",
        },
      ],
      [],
      parentPlacements,
    );

    expect(result).toEqual([]);
  });

  it("keeps a placed-parent assignment while that placement is still active", () => {
    const parentPlacements: ParentPlacementRow[] = [
      {
        biological_parent_id: "parent-1",
        child_id: "child-1",
        household_id: "house-1",
        is_active: true,
        start_date: "2026-08-16",
        end_date: null,
      },
    ];

    const assignment = {
      assigned_date: "2026-08-23",
      assignment_subject: "placed_parent",
      child_id: "child-1",
      biological_parent_id: "parent-1",
      household_id: "house-1",
    };

    expect(
      filterAssignmentsToActivePlacements([assignment], [], parentPlacements),
    ).toEqual([assignment]);
  });

  it("drops an assignment with no matching placement row at all", () => {
    const result = filterAssignmentsToActivePlacements(
      [
        {
          assigned_date: "2026-08-23",
          assignment_subject: "child",
          child_id: "unknown-child",
          biological_parent_id: null,
          household_id: "house-1",
        },
      ],
      [],
      [],
    );

    expect(result).toEqual([]);
  });
});
