import { describe, expect, it } from "vitest";
import {
  buildChildDocumentStoragePath,
  buildFigChatStoragePath,
  buildLifeStoryStoragePath,
  childDocumentChildIdFromPath,
  dailyLogAssignmentIdFromPath,
  dailyLogStorageSubjectId,
  extensionFromFileName,
  figChatConversationIdFromPath,
  isChildDocumentPathForUploader,
  lifeStoryChildIdFromPath,
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

describe("buildFigChatStoragePath / figChatConversationIdFromPath", () => {
  it("matches the figchat bucket's RLS-required shape and round-trips the conversation id back out", () => {
    const path = buildFigChatStoragePath({
      agencyId: "agency-1",
      conversationId: "conv-1",
      fileName: "photo.png",
    });
    expect(path).toMatch(
      /^agency\/agency-1\/conversation\/conv-1\/[^/]+\.png$/,
    );
    expect(figChatConversationIdFromPath(path)).toBe("conv-1");
  });

  it("rejects a path scoped to a different conversation", () => {
    const path = buildFigChatStoragePath({
      agencyId: "agency-1",
      conversationId: "conv-1",
      fileName: "photo.png",
    });
    expect(figChatConversationIdFromPath(path)).not.toBe("conv-2");
  });
});

describe("buildLifeStoryStoragePath / lifeStoryChildIdFromPath", () => {
  it("matches the life_story bucket's RLS-required shape (own uid first) and round-trips the child id back out", () => {
    const path = buildLifeStoryStoragePath({
      userId: "user-1",
      childId: "child-1",
      section: "leisure_fun",
      fileName: "photo.png",
    });
    expect(path).toMatch(
      /^user-1\/children\/child-1\/leisure_fun\/[^/]+\.png$/,
    );
    expect(lifeStoryChildIdFromPath(path)).toBe("child-1");
  });

  it("rejects a path scoped to a different child", () => {
    const path = buildLifeStoryStoragePath({
      userId: "user-1",
      childId: "child-1",
      section: "leisure_fun",
      fileName: "photo.png",
    });
    expect(lifeStoryChildIdFromPath(path)).not.toBe("child-2");
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

describe("buildChildDocumentStoragePath / childDocumentChildIdFromPath", () => {
  it("matches web child-document path shape and round-trips the child id", () => {
    const path = buildChildDocumentStoragePath({
      userId: "user-1",
      childId: "child-1",
      fileName: "report.pdf",
    });
    expect(path).toMatch(
      /^user-1\/children\/child-1\/documents\/[^/]+\.pdf$/,
    );
    expect(childDocumentChildIdFromPath(path)).toBe("child-1");
    expect(isChildDocumentPathForUploader(path, "user-1", "child-1")).toBe(
      true,
    );
    expect(isChildDocumentPathForUploader(path, "user-2", "child-1")).toBe(
      false,
    );
  });
});
