import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  DocumentAssigneeJoinRow,
  DocumentRow,
} from "../types/documents.js";

const DOCUMENT_FIELDS = `
  id,
  title,
  document_type,
  description,
  file_url,
  file_path,
  file_size_bytes,
  file_type,
  status,
  created_at,
  updated_at,
  agency_id,
  parent_document_id,
  owner_id,
  created_by,
  child_id,
  completed_at,
  completed_by_user_id,
  completed_by_name,
  completed_by_figapp_id,
  completion_declaration,
  final_file_url,
  final_file_path,
  finalized_at,
  finalization_status,
  finalization_error
`;

const ASSIGNEE_WITH_DOCUMENT_SELECT = `
  id,
  document_id,
  user_id,
  status,
  has_read,
  read_at,
  signed_at,
  created_at,
  documents (
    ${DOCUMENT_FIELDS}
  )
`;

export async function listDocumentAssignmentsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: DocumentAssigneeJoinRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DOCUMENT_ASSIGNEES)
    .select(ASSIGNEE_WITH_DOCUMENT_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  return {
    data: ((data as DocumentAssigneeJoinRow[] | null) ?? []),
    error,
  };
}

export async function findDocumentAssignmentForUser(
  supabase: SupabaseClient,
  documentId: string,
  userId: string,
): Promise<{ data: DocumentAssigneeJoinRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DOCUMENT_ASSIGNEES)
    .select(ASSIGNEE_WITH_DOCUMENT_SELECT)
    .eq("document_id", documentId)
    .eq("user_id", userId)
    .maybeSingle();

  return {
    data: (data as DocumentAssigneeJoinRow | null) ?? null,
    error,
  };
}

export async function updateDocumentAssigneeSign(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    userId: string;
    now: string;
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.DOCUMENT_ASSIGNEES)
    .update({
      has_read: true,
      read_at: params.now,
      signed_at: params.now,
      status: "signed",
    })
    .eq("document_id", params.documentId)
    .eq("user_id", params.userId);

  return { error };
}

export async function updateDocumentCompleted(
  supabase: SupabaseClient,
  params: {
    documentId: string;
    now: string;
    completedByUserId: string;
    completedByName: string;
    completedByFigappId: string | null;
    completionDeclaration: string;
    completedUserAgent: string | null;
    finalizationStatus: string | null;
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.DOCUMENTS)
    .update({
      status: "completed",
      completed_at: params.now,
      completed_by_user_id: params.completedByUserId,
      completed_by_name: params.completedByName,
      completed_by_figapp_id: params.completedByFigappId,
      completion_declaration: params.completionDeclaration,
      completed_user_agent: params.completedUserAgent,
      finalization_status: params.finalizationStatus,
      finalization_error: null,
    })
    .eq("id", params.documentId);

  return { error };
}

export async function findDocumentAccessibleByPath(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<{ data: DocumentRow | null; error: Error | null }> {
  const { data, error } = await listDocumentAssignmentsForUser(supabase, userId);
  if (error) return { data: null, error };

  for (const row of data) {
    const doc = unwrapDocument(row.documents);
    if (!doc) continue;
    const candidates = [
      doc.final_file_path,
      doc.file_path,
      doc.final_file_url,
      doc.file_url,
    ]
      .map(normalizeStoragePath)
      .filter((p): p is string => !!p);
    if (candidates.includes(path)) {
      return { data: doc, error: null };
    }
  }

  return { data: null, error: null };
}

export function unwrapDocument(
  value: DocumentRow | DocumentRow[] | null | undefined,
): DocumentRow | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export function normalizeStoragePath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  // Web sometimes stores path in file_url; ignore absolute http URLs.
  if (/^https?:\/\//i.test(trimmed)) return null;
  return trimmed.replace(/^\/+/, "");
}
