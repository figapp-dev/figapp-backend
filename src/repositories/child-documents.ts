import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type { DocumentRow } from "../types/documents.js";
import { normalizeStoragePath } from "./documents.js";

const CHILD_DOCUMENT_FIELDS = `
  id,
  title,
  file_url,
  file_path,
  file_type,
  file_size_bytes,
  created_at,
  created_by,
  child_id,
  parent_document_id,
  document_type,
  description,
  status,
  agency_id,
  owner_id
`;

export async function listChildDocuments(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ data: DocumentRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DOCUMENTS)
    .select(CHILD_DOCUMENT_FIELDS)
    .eq("child_id", childId)
    .is("parent_document_id", null)
    .order("created_at", { ascending: false });

  return {
    data: ((data as DocumentRow[] | null) ?? []),
    error,
  };
}

export async function findChildDocumentByStoragePath(
  supabase: SupabaseClient,
  path: string,
): Promise<{ data: DocumentRow | null; error: Error | null }> {
  const normalized = normalizeStoragePath(path);
  if (!normalized) {
    return { data: null, error: null };
  }

  const byPath = await supabase
    .from(TABLES.DOCUMENTS)
    .select(CHILD_DOCUMENT_FIELDS)
    .not("child_id", "is", null)
    .is("parent_document_id", null)
    .eq("file_path", normalized)
    .limit(1)
    .maybeSingle();

  if (byPath.error) {
    return { data: null, error: byPath.error };
  }
  if (byPath.data) {
    return { data: byPath.data as DocumentRow, error: null };
  }

  const byUrl = await supabase
    .from(TABLES.DOCUMENTS)
    .select(CHILD_DOCUMENT_FIELDS)
    .not("child_id", "is", null)
    .is("parent_document_id", null)
    .eq("file_url", normalized)
    .limit(1)
    .maybeSingle();

  return {
    data: (byUrl.data as DocumentRow | null) ?? null,
    error: byUrl.error,
  };
}

export async function insertChildDocument(
  supabase: SupabaseClient,
  row: {
    agencyId: string;
    childId: string;
    userId: string;
    title: string;
    filePath: string;
    fileType: string | null;
    fileSizeBytes: number | null;
  },
): Promise<{ data: DocumentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DOCUMENTS)
    .insert({
      agency_id: row.agencyId,
      title: row.title,
      description: "Child profile document",
      file_path: row.filePath,
      file_url: row.filePath,
      file_size_bytes: row.fileSizeBytes,
      file_type: row.fileType,
      document_type: "general",
      status: "unassigned",
      owner_id: row.userId,
      created_by: row.userId,
      child_id: row.childId,
    })
    .select(CHILD_DOCUMENT_FIELDS)
    .single();

  return {
    data: (data as DocumentRow | null) ?? null,
    error,
  };
}
