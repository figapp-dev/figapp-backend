import { describe, expect, it } from "vitest";
import {
  buildAssignmentUpdate,
  parseSaveIntent,
  resolveNextLogStatus,
  shouldUpdateAssignmentStatus,
} from "../../../src/services/daily-logs/save-rules.js";

describe("parseSaveIntent", () => {
  it("defaults to save", () => {
    expect(parseSaveIntent(undefined)).toBe("save");
    expect(parseSaveIntent("save")).toBe("save");
    expect(parseSaveIntent("submit")).toBe("submit");
  });
});

describe("resolveNextLogStatus", () => {
  it("marks submit as completed", () => {
    expect(resolveNextLogStatus("submit", "in_progress")).toBe("completed");
  });

  it("keeps completed status on same-day save", () => {
    expect(resolveNextLogStatus("save", "completed")).toBe("completed");
    expect(resolveNextLogStatus("save", "submitted")).toBe("submitted");
  });

  it("uses in_progress for draft saves", () => {
    expect(resolveNextLogStatus("save", null)).toBe("in_progress");
    expect(resolveNextLogStatus("save", "pending")).toBe("in_progress");
  });
});

describe("shouldUpdateAssignmentStatus", () => {
  it("skips update when saving an already-completed assignment", () => {
    expect(shouldUpdateAssignmentStatus("save", "completed")).toBe(false);
  });

  it("updates on submit or non-completed save", () => {
    expect(shouldUpdateAssignmentStatus("submit", "completed")).toBe(true);
    expect(shouldUpdateAssignmentStatus("save", "in_progress")).toBe(true);
  });
});

describe("buildAssignmentUpdate", () => {
  it("sets completed on submit and in_progress on save", () => {
    expect(buildAssignmentUpdate("submit", "2026-08-12T10:00:00.000Z")).toEqual({
      status: "completed",
      completed_at: "2026-08-12T10:00:00.000Z",
    });
    expect(buildAssignmentUpdate("save", "2026-08-12T10:00:00.000Z")).toEqual({
      status: "in_progress",
    });
  });
});
