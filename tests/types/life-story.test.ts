import { describe, expect, it } from "vitest";
import {
  isLifeStorySectionKey,
  lifeStorySectionLabel,
  normalizeLifeStorySectionKey,
} from "../../src/types/life-story.js";

describe("isLifeStorySectionKey", () => {
  it("accepts only the known section keys", () => {
    expect(isLifeStorySectionKey("leisure_fun")).toBe(true);
    expect(isLifeStorySectionKey("academic_achievements")).toBe(true);
    expect(isLifeStorySectionKey("milestones")).toBe(true);
    expect(isLifeStorySectionKey("other_events")).toBe(true);
    expect(isLifeStorySectionKey("other_achievements")).toBe(false);
    expect(isLifeStorySectionKey("not_a_section")).toBe(false);
    expect(isLifeStorySectionKey(undefined)).toBe(false);
  });
});

describe("normalizeLifeStorySectionKey", () => {
  it("maps the legacy other_achievements key to other_events", () => {
    expect(normalizeLifeStorySectionKey("other_achievements")).toBe(
      "other_events",
    );
    expect(normalizeLifeStorySectionKey("milestones")).toBe("milestones");
  });
});

describe("lifeStorySectionLabel", () => {
  it("returns the human-readable label for a section key", () => {
    expect(lifeStorySectionLabel("leisure_fun")).toBe("Leisure & Fun");
    expect(lifeStorySectionLabel("academic_achievements")).toBe(
      "Academic Achievements",
    );
    expect(lifeStorySectionLabel("milestones")).toBe("Milestones");
    expect(lifeStorySectionLabel("other_events")).toBe("Other Events");
  });
});
