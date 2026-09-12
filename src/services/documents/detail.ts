import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toDocumentListItemDto } from "../../mappers/documents.js";
import { findDocumentAssignmentForUser } from "../../repositories/documents.js";
import type { DocumentListItemDto } from "../../types/documents.js";

export async function getDocumentForCarer(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
) {
  const { data, error } = await findDocumentAssignmentForUser(
    supabase,
    documentId,
    userId,
  );
  if (error) return serviceFailure({ error });
  if (!data) return serviceFailure({ notFound: true });

  const dto = toDocumentListItemDto(data);
  if (!dto) return serviceFailure({ notFound: true });

  return serviceSuccess<DocumentListItemDto>(dto);
}
