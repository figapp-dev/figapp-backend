import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { toDocumentListItemDto } from "../../mappers/documents.js";
import { listDocumentAssignmentsForUser } from "../../repositories/documents.js";
import type { DocumentListDto } from "../../types/documents.js";

export type ListDocumentsQuery = {
  status?: "all" | "to_review" | "completed";
};

export async function listDocumentsForCarer(
  supabase: SupabaseClient,
  userId: string,
  query: ListDocumentsQuery = {},
) {
  const { data, error } = await listDocumentAssignmentsForUser(supabase, userId);
  if (error) return serviceFailure({ error });

  const all = data
    .map(toDocumentListItemDto)
    .filter((d): d is NonNullable<typeof d> => d != null);

  const toReviewCount = all.filter((d) => d.displayStatus !== "completed").length;
  const status = query.status ?? "all";
  const documents =
    status === "to_review"
      ? all.filter((d) => d.displayStatus !== "completed")
      : status === "completed"
        ? all.filter((d) => d.displayStatus === "completed")
        : all;

  return serviceSuccess<DocumentListDto>({ documents, toReviewCount });
}
