import { describe, expect, it } from "vitest";
import {
  dailyLogAssignmentIdFromPath,
  dailyLogStorageSubjectId,
  extensionFromFileName,
  sanitizeFileName,
} from "../../../src/services/files/paths.js";

describe("dailyLogStorageSubjectId", () => {
  it("prefers child, then biological parent, then assignment id", () => {
    expect(
      dailyLogStorageSubjectId({
        id: "a1",
        child_id: "c1",
        biological_parent_id: "p1",
      }),
    ).toBe("c1");
    expect(
      dailyLogStorageSubjectId({
        id: "a1",
        child_id: null,
        biological_parent_id: "p1",
      }),
    ).toBe("p1");
    expect(
      dailyLogStorageSubjectId({
        id: "a1",
        child_id: null,
        biological_parent_id: null,
      }),
    ).toBe("a1");
  });
});

describe("dailyLogAssignmentIdFromPath", () => {
  it("reads assignment id from storage path", () => {
    expect(
      dailyLogAssignmentIdFromPath("c1/a1/field-x/uuid.png"),
    ).toBe("a1");
    expect(dailyLogAssignmentIdFromPath("only-one")).toBeNull();
  });
});

describe("sanitizeFileName / extensionFromFileName", () => {
  it("sanitizes and extracts extensions", () => {
    expect(sanitizeFileName("a/b\\c.png")).toBe("a_b_c.png");
    expect(sanitizeFileName("   ")).toBe("upload.bin");
    expect(extensionFromFileName("photo.JPEG")).toBe("jpeg");
    expect(extensionFromFileName("noext")).toBe("bin");
  });
});
