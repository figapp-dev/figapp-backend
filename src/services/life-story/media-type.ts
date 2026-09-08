import { extensionFromFileName } from "../files/paths.js";
import type { LifeStoryMediaType } from "../../types/life-story.js";

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
  "bmp",
  "svg",
  "heic",
  "heif",
  "avif",
  "tiff",
  "tif",
]);

const VIDEO_EXTENSIONS = new Set(["mp4", "mov", "webm", "avi", "m4v"]);

/** No raw File object on the server — infer from the client-supplied
 * contentType first, falling back to the file extension. Mirrors web's
 * getLifeStoryMediaType / inferMediaTypeFromUrl combined. */
export function inferLifeStoryMediaType(
  fileName: string,
  contentType?: string | null,
): LifeStoryMediaType {
  if (contentType?.startsWith("image/")) return "photo";
  if (contentType?.startsWith("video/")) return "video";

  const ext = extensionFromFileName(fileName);
  if (IMAGE_EXTENSIONS.has(ext)) return "photo";
  if (VIDEO_EXTENSIONS.has(ext)) return "video";
  return "file";
}
