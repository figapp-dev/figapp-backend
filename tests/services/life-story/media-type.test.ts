import { describe, expect, it } from "vitest";
import { inferLifeStoryMediaType } from "../../../src/services/life-story/media-type.js";

describe("inferLifeStoryMediaType", () => {
  it("prefers the client-supplied contentType when present", () => {
    expect(inferLifeStoryMediaType("clip.bin", "video/mp4")).toBe("video");
    expect(inferLifeStoryMediaType("photo.bin", "image/heic")).toBe("photo");
  });

  it("falls back to the file extension when contentType is missing", () => {
    expect(inferLifeStoryMediaType("photo.HEIC")).toBe("photo");
    expect(inferLifeStoryMediaType("clip.mov")).toBe("video");
    expect(inferLifeStoryMediaType("certificate.pdf")).toBe("file");
  });
});
