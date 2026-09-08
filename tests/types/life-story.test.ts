import { describe, expect, it } from "vitest";
import {
  isLifeStorySectionKey,
  lifeStorySectionLabel,
} from "../../src/types/life-story.js";

describe("isLifeStorySectionKey", () => {
  it("accepts only the three known section keys", () => {
    expect(isLifeStorySectionKey("leisure_fun")).toBe(true);
    expect(isLifeStorySectionKey("academic_achievements")).toBe(true);
    expect(isLifeStorySectionKey("other_achievements")).toBe(true);
    expect(isLifeStorySectionKey("not_a_section")).toBe(false);
    expect(isLifeStorySectionKey(undefined)).toBe(false);
  });
});

describe("lifeStorySectionLabel", () => {
  it("returns the human-readable label for a section key", () => {
    expect(lifeStorySectionLabel("leisure_fun")).toBe("Leisure & Fun");
    expect(lifeStorySectionLabel("academic_achievements")).toBe(
      "Academic Achievements",
    );
    expect(lifeStorySectionLabel("other_achievements")).toBe(
      "Other Achievements",
    );
  });
});
