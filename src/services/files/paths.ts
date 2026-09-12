import { randomUUID } from "node:crypto";
import type { DailyLogAssignmentAccess } from "./access.js";

/** Storage path prefix: child id, else placed-parent id, else assignment id. */
export function dailyLogStorageSubjectId(
  assignment: Pick<
    DailyLogAssignmentAccess,
    "id" | "child_id" | "biological_parent_id"
  >,
): string {
  return (
    assignment.child_id ||
    assignment.biological_parent_id ||
    assignment.id
  );
}

export function sanitizeFileName(fileName: string): string {
  const base = fileName.trim().replace(/[/\\]/g, "_");
  return base.length > 0 ? base : "upload.bin";
}

export function extensionFromFileName(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "bin";
  const ext = parts.pop()?.toLowerCase().replace(/[^a-z0-9]/g, "");
  return ext || "bin";
}

/**
 * Path shape: `{subjectId}/{assignmentId}/{fieldId}/{uuid}.ext`
 * Returns the assignment id segment.
 */
export function dailyLogAssignmentIdFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 2) return null;
  return parts[1] ?? null;
}

export function buildDailyLogStoragePath(options: {
  assignment: Pick<
    DailyLogAssignmentAccess,
    "id" | "child_id" | "biological_parent_id"
  >;
  fieldId: string;
  fileName: string;
}): string {
  const subjectId = dailyLogStorageSubjectId(options.assignment);
  const ext = extensionFromFileName(options.fileName);
  return `${subjectId}/${options.assignment.id}/${options.fieldId}/${randomUUID()}.${ext}`;
}

/**
 * Path shape: `agency/{agencyId}/conversation/{conversationId}/{uuid}.ext`
 * — must match this exactly (not just any prefix). The 'figchat' storage
 * bucket's RLS policies (figchat_insert_same_agency_or_admin /
 * _select_same_agency_or_admin) require foldername(name)[1] = 'agency' and
 * foldername(name)[2] = the caller's own agency_id; anything else — e.g. a
 * bare `{conversationId}/...` path — fails with an opaque "new row violates
 * row-level security policy" on the storage insert. Matches web's own
 * makeStorageKey() in FigChatWorkspace.tsx, since this bucket is shared.
 */
export function buildFigChatStoragePath(options: {
  agencyId: string;
  conversationId: string;
  fileName: string;
}): string {
  const ext = extensionFromFileName(options.fileName);
  return `agency/${options.agencyId}/conversation/${options.conversationId}/${randomUUID()}.${ext}`;
}

/** The conversation id segment of a buildFigChatStoragePath() path — used to
 * confirm an attachment path belongs to the conversation a message is being
 * sent to, before signing a download URL for it. */
export function figChatConversationIdFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts[3] ?? null;
}

/**
 * Path shape: `{userId}/children/{childId}/{section}/{uuid}.ext` — must
 * start with the uploader's own auth uid and have 'children' as the second
 * segment. The 'life_story' storage bucket's RLS policies
 * (life_story_insert_own_folder / _update_own_folder / _delete_own_folder)
 * require foldername(name)[1] = auth.uid()::text; the SELECT policy
 * additionally allows foldername(name)[2] = 'children' with an
 * agency/children join, matching this shape. Anything else fails with an
 * opaque "new row violates row-level security policy" on the storage
 * insert. Matches web's own addLeisurePhotosFromDailyLog.ts, since this
 * bucket and the children.life_story_data column are shared with web.
 */
export function buildLifeStoryStoragePath(options: {
  userId: string;
  childId: string;
  section: string;
  fileName: string;
}): string {
  const ext = extensionFromFileName(options.fileName);
  return `${options.userId}/children/${options.childId}/${options.section}/${randomUUID()}.${ext}`;
}

/** The child id segment of a buildLifeStoryStoragePath() path — used to
 * confirm a media path belongs to the child an entry is being added for,
 * before accepting it into children.life_story_data. */
export function lifeStoryChildIdFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts[2] ?? null;
}

/**
 * Path shape: `{userId}/children/{childId}/documents/{uuid}.ext` — matches
 * web ChildProfileDialog upload into the private `documents` bucket. Storage
 * insert RLS requires foldername(name)[1] = auth.uid()::text.
 */
export function buildChildDocumentStoragePath(options: {
  userId: string;
  childId: string;
  fileName: string;
}): string {
  const ext = extensionFromFileName(options.fileName);
  return `${options.userId}/children/${options.childId}/documents/${randomUUID()}.${ext}`;
}

/** Child id from a child-document storage path; null if shape is wrong. */
export function childDocumentChildIdFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  if (parts.length < 5) return null;
  if (parts[1] !== "children" || parts[3] !== "documents") return null;
  return parts[2] ?? null;
}

/** True when path was minted for this uploader + child (POST metadata check). */
export function isChildDocumentPathForUploader(
  path: string,
  userId: string,
  childId: string,
): boolean {
  const parts = path.split("/").filter(Boolean);
  return (
    parts.length >= 5 &&
    parts[0] === userId &&
    parts[1] === "children" &&
    parts[2] === childId &&
    parts[3] === "documents"
  );
}
