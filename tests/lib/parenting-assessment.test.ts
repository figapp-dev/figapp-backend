import { describe, expect, it } from "vitest";
import {
  calculateBiologicalParentAge,
  createParentingAssessmentSection,
  insertParentingAssessmentSection,
  isBiologicalParentAdultForParentingAssessment,
  isBiologicalParentUnder18ForOwnDailyLog,
  isParentingAssessmentSection,
} from "../../src/lib/parenting-assessment.js";

describe("calculateBiologicalParentAge", () => {
  it("computes whole years as of the given date", () => {
    expect(
      calculateBiologicalParentAge("2000-06-15", new Date("2026-06-14")),
    ).toBe(25);
    expect(
      calculateBiologicalParentAge("2000-06-15", new Date("2026-06-15")),
    ).toBe(26);
  });

  it("returns null for missing or invalid dates", () => {
    expect(calculateBiologicalParentAge(null)).toBeNull();
    expect(calculateBiologicalParentAge("not-a-date")).toBeNull();
  });
});

describe("adult vs under-18 placed parent classification", () => {
  const adult = "2000-01-01"; // 18+ as of any date in this suite's range
  const minor = "2020-01-01"; // under 18

  it("treats 18+ as adult-for-child-log, not own-log", () => {
    expect(
      isBiologicalParentAdultForParentingAssessment(adult),
    ).toBe(true);
    expect(isBiologicalParentUnder18ForOwnDailyLog(adult)).toBe(false);
  });

  it("treats under-18 as own-log, not adult-for-child-log", () => {
    expect(
      isBiologicalParentAdultForParentingAssessment(minor),
    ).toBe(false);
    expect(isBiologicalParentUnder18ForOwnDailyLog(minor)).toBe(true);
  });
});

describe("createParentingAssessmentSection", () => {
  it("adds a parent-select field only when more than one parent is assessed", () => {
    const single = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
    ]);
    const fieldIds = (single.fields as Array<{ id: string }>).map((f) => f.id);
    expect(fieldIds).not.toContain("parenting_assessed_parent");

    const multiple = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
      { id: "p2", name: "Parent2", relationship: "Father" },
    ]);
    const multiFieldIds = (multiple.fields as Array<{ id: string }>).map(
      (f) => f.id,
    );
    expect(multiFieldIds[0]).toBe("parenting_assessed_parent");
  });

  it("marks the core assessment fields as required, notes as optional", () => {
    const section = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
    ]);
    const fields = section.fields as Array<{ id: string; required: boolean }>;
    const byId = Object.fromEntries(fields.map((f) => [f.id, f.required]));
    expect(byId.parenting_daily_observations).toBe(true);
    expect(byId.parenting_care_meeting_needs).toBe(true);
    expect(byId.parenting_safety_awareness).toBe(true);
    expect(byId.parenting_emotional_regulation).toBe(true);
    expect(byId.parenting_follow_up_needed).toBe(true);
    expect(byId.parenting_concerns).toBe(false);
  });
});

describe("insertParentingAssessmentSection", () => {
  const baseTemplate = [
    { id: "morning", title: "Morning routine & meals", fields: [] },
    { id: "incidents", title: "Incidents & final comments", fields: [] },
  ];

  it("inserts the section right before Incidents & final comments", () => {
    const section = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
    ]);
    const result = insertParentingAssessmentSection(
      baseTemplate,
      section,
    ) as Array<{ id: string }>;
    expect(result.map((s) => s.id)).toEqual([
      "morning",
      "parenting_assessment",
      "incidents",
    ]);
  });

  it("appends when there is no incidents section", () => {
    const section = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
    ]);
    const result = insertParentingAssessmentSection(
      [{ id: "morning", title: "Morning routine & meals", fields: [] }],
      section,
    ) as Array<{ id: string }>;
    expect(result.map((s) => s.id)).toEqual(["morning", "parenting_assessment"]);
  });

  it("strips a stale section and adds nothing when section is null", () => {
    const withStale = [
      ...baseTemplate,
      { id: "parenting_assessment", title: "Parenting Assessment", fields: [] },
    ];
    const result = insertParentingAssessmentSection(
      withStale,
      null,
    ) as Array<{ id: string }>;
    expect(result.map((s) => s.id)).toEqual(["morning", "incidents"]);
  });

  it("replaces rather than duplicates an existing section", () => {
    const withStale = [
      ...baseTemplate,
      { id: "parenting_assessment", title: "Parenting Assessment", fields: [] },
    ];
    const section = createParentingAssessmentSection([
      { id: "p1", name: "Parent1", relationship: "Mother" },
    ]);
    const result = insertParentingAssessmentSection(
      withStale,
      section,
    ) as Array<{ id: string }>;
    expect(result.filter((s) => isParentingAssessmentSection(s))).toHaveLength(
      1,
    );
  });
});
