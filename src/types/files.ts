/**
 * Which FigApp feature the file belongs to.
 * `id` meaning changes per resource:
 * - daily_log → same id as GET /daily-logs/:id (assignment id)
 * - figchat → conversation id
 * - (later) life_story → child id, document → document id, etc.
 */
export type FileResource = "daily_log" | "figchat";

export type CreateFileUploadBody = {
  resource: FileResource;
  id: string;
  /** Template field / question id — required for daily_log, unused for figchat. */
  fieldId?: string;
  fileName: string;
};

export type CreateFileUploadDto = {
  resource: FileResource;
  id: string;
  bucket: string;
  path: string;
  token: string;
  signedUrl: string;
  fileName: string;
};

export type CreateSignedUrlBody = {
  bucket: string;
  path: string;
  expiresIn?: number;
};

export type SignedUrlDto = {
  bucket: string;
  path: string;
  signedUrl: string;
  expiresIn: number;
};
