import type { DocumentRow } from "../types/documents.js";
import type { ChildDocumentDto } from "../types/child-documents.js";
import { normalizeStoragePath } from "../repositories/documents.js";

export function toChildDocumentDto(row: DocumentRow): ChildDocumentDto | null {
  if (!row.id || !row.child_id) return null;
  return {
    id: row.id,
    title: row.title?.trim() || "Document",
    filePath: normalizeStoragePath(row.file_path) ??
      normalizeStoragePath(row.file_url),
    fileType: row.file_type,
    fileSizeBytes: row.file_size_bytes,
    createdAt: row.created_at,
    createdBy: row.created_by,
    childId: row.child_id,
  };
}
