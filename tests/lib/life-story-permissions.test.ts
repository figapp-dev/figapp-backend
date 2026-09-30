import { describe, expect, it } from "vitest";
import { canRoleAddLifeStoryEntry } from "../../src/lib/life-story-permissions.js";

describe("canRoleAddLifeStoryEntry", () => {
  it("blocks plain social_worker", () => {
    expect(canRoleAddLifeStoryEntry("social_worker")).toBe(false);
  });

  it("allows sw_manager, foster_carer, and every other role", () => {
    expect(canRoleAddLifeStoryEntry("sw_manager")).toBe(true);
    expect(canRoleAddLifeStoryEntry("foster_carer")).toBe(true);
    expect(canRoleAddLifeStoryEntry(null)).toBe(true);
  });
});
