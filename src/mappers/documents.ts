import {
  normalizeStoragePath,
  unwrapDocument,
} from "../repositories/documents.js";
import type {
  DocumentAssigneeJoinRow,
  DocumentAssignmentDto,
  DocumentListItemDto,
} from "../types/documents.js";

function normalizeStatus(status?: string | null): string {
  return String(status || "")
    .toLowerCase()
    .trim();
}

export function displayStatusForAssignee(
  assigneeStatus: string | null | undefined,
): "assigned" | "completed" {
  const status = normalizeStatus(assigneeStatus);
  if (status === "signed" || status === "completed") return "completed";
  return "assigned";
}

export function documentExtension(doc: {
  title?: string | null;
  file_type?: string | null;
}): string {
  const title = doc.title ?? "";
  const dot = title.lastIndexOf(".");
  if (dot > 0 && dot < title.length - 1) {
    return title.slice(dot + 1).toLowerCase();
  }
  if (doc.file_type === "application/pdf") return "pdf";
  if (doc.file_type === "image/png") return "png";
  if (doc.file_type === "image/jpeg") return "jpg";
  return "";
}

export function supportsFinalPdf(doc: {
  title?: string | null;
  file_type?: string | null;
}): boolean {
  return ["pdf", "png", "jpg", "jpeg"].includes(documentExtension(doc));
}

export function toDocumentListItemDto(
  row: DocumentAssigneeJoinRow,
): DocumentListItemDto | null {
  const doc = unwrapDocument(row.documents);
  if (!doc) return null;

  const displayStatus = displayStatusForAssignee(row.status);
  const previewPath =
    normalizeStoragePath(doc.final_file_path) ??
    normalizeStoragePath(doc.file_path) ??
    normalizeStoragePath(doc.final_file_url) ??
    normalizeStoragePath(doc.file_url);

  const assignment: DocumentAssignmentDto = {
    id: row.id,
    status: normalizeStatus(row.status) || "assigned",
    hasRead: row.has_read === true,
    readAt: row.read_at,
    signedAt: row.signed_at,
  };

  return {
    id: doc.id,
    title: (doc.title ?? "").trim() || "Untitled document",
    documentType: doc.document_type,
    description: doc.description,
    filePath: normalizeStoragePath(doc.file_path) ?? normalizeStoragePath(doc.file_url),
    fileType: doc.file_type,
    fileSizeBytes: doc.file_size_bytes,
    status: doc.status,
    displayStatus,
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
    childId: doc.child_id,
    finalFilePath: normalizeStoragePath(doc.final_file_path),
    finalizationStatus: doc.finalization_status,
    previewPath,
    canSign: displayStatus !== "completed",
    assignment,
  };
}
