import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  supportsFinalPdf,
  toDocumentListItemDto,
} from "../../mappers/documents.js";
import { findAgencyUserProfileByUserId } from "../../repositories/profile.js";
import {
  findDocumentAssignmentForUser,
  unwrapDocument,
  updateDocumentAssigneeSign,
  updateDocumentCompleted,
} from "../../repositories/documents.js";
import {
  STANDARD_DOCUMENT_DECLARATION,
  type DocumentSignResultDto,
  type SignDocumentBody,
} from "../../types/documents.js";

async function invokeFinalizeDocument(
  supabase: SupabaseClient,
  documentId: string,
): Promise<{ ok: boolean; unsupported?: boolean; message?: string }> {
  try {
    const { data, error } = await supabase.functions.invoke("finalize-document", {
      body: { documentId },
    });
    if (error) {
      console.error("finalize-document failed:", error.message ?? error);
      return {
        ok: false,
        message:
          "Completion was saved, but final PDF generation could not be completed.",
      };
    }
    if (data?.unsupported) {
      return {
        ok: true,
        unsupported: true,
        message:
          "Completion was saved, but automatic final PDF is currently supported only for PDF and image files.",
      };
    }
    return {
      ok: true,
      message: "Final PDF with declaration page has been generated.",
    };
  } catch (error) {
    console.error("finalize-document invoke error:", error);
    return {
      ok: false,
      message:
        "Completion was saved, but final PDF generation could not be completed.",
    };
  }
}

export async function signDocumentForCarer(
  supabase: SupabaseClient,
  userId: string,
  documentId: string,
  body: SignDocumentBody,
  options?: { userAgent?: string | null },
) {
  if (body.hasRead !== true) {
    return serviceFailure({ badRequest: true });
  }

  const { data: assignment, error: assignmentError } =
    await findDocumentAssignmentForUser(supabase, documentId, userId);
  if (assignmentError) return serviceFailure({ error: assignmentError });
  if (!assignment) return serviceFailure({ notFound: true });

  const existing = toDocumentListItemDto(assignment);
  if (!existing) return serviceFailure({ notFound: true });
  if (!existing.canSign) {
    // Already signed — idempotent success with current row.
    return serviceSuccess<DocumentSignResultDto>({
      document: existing,
      finalized: !!existing.finalFilePath,
      finalizationMessage: null,
    });
  }

  const doc = unwrapDocument(assignment.documents);
  if (!doc) return serviceFailure({ notFound: true });

  const { data: profile, error: profileError } =
    await findAgencyUserProfileByUserId(supabase, userId);
  if (profileError) return serviceFailure({ error: profileError });

  const fullName =
    `${profile?.first_name ?? ""} ${profile?.last_name ?? ""}`.trim() ||
    profile?.email ||
    "Unknown User";
  const figAppId = profile?.figapp_id ?? null;
  const now = new Date().toISOString();
  const canFinalize = supportsFinalPdf(doc);

  const { error: assigneeErr } = await updateDocumentAssigneeSign(supabase, {
    documentId,
    userId,
    now,
  });
  if (assigneeErr) return serviceFailure({ error: assigneeErr });

  const { error: docErr } = await updateDocumentCompleted(supabase, {
    documentId,
    now,
    completedByUserId: userId,
    completedByName: fullName,
    completedByFigappId: figAppId,
    completionDeclaration: STANDARD_DOCUMENT_DECLARATION,
    completedUserAgent: options?.userAgent ?? null,
    finalizationStatus: canFinalize ? "pending" : null,
  });
  if (docErr) return serviceFailure({ error: docErr });

  let finalized = false;
  let finalizationMessage: string | null = null;

  if (canFinalize) {
    const result = await invokeFinalizeDocument(supabase, documentId);
    finalized = result.ok && !result.unsupported;
    finalizationMessage = result.message ?? null;
  } else {
    finalizationMessage =
      "Completion was saved. Automatic final PDF is currently available only for PDF and image files.";
  }

  const { data: refreshed, error: refreshError } =
    await findDocumentAssignmentForUser(supabase, documentId, userId);
  if (refreshError) return serviceFailure({ error: refreshError });
  const dto = refreshed ? toDocumentListItemDto(refreshed) : existing;
  if (!dto) return serviceFailure({ notFound: true });

  return serviceSuccess<DocumentSignResultDto>({
    document: dto,
    finalized,
    finalizationMessage,
  });
}
