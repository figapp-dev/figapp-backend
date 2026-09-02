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

/** Path shape: `{conversationId}/{uuid}.ext`. */
export function buildFigChatStoragePath(options: {
  conversationId: string;
  fileName: string;
}): string {
  const ext = extensionFromFileName(options.fileName);
  return `${options.conversationId}/${randomUUID()}.${ext}`;
}

/** First path segment — used to confirm an attachment path belongs to the
 * conversation a message is being sent to, before signing a download URL
 * for it. */
export function figChatConversationIdFromPath(path: string): string | null {
  const parts = path.split("/").filter(Boolean);
  return parts[0] ?? null;
}
