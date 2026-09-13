import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  DEFAULT_SIGNED_URL_EXPIRES_SECONDS,
  STORAGE_BUCKETS,
  isAllowedStorageBucket,
} from "../../lib/storage.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { findChildDocumentByStoragePath } from "../../repositories/child-documents.js";
import { findDocumentAccessibleByPath } from "../../repositories/documents.js";
import { createSignedDownloadUrl as createStorageSignedDownloadUrl } from "../../repositories/files.js";
import {
  findTicketAttachmentByPath,
  findTicketByIdForCreator,
} from "../../repositories/tickets.js";
import {
  findExpenseAttachmentByPath,
  findExpenseClaimByIdForCarer,
} from "../../repositories/expenses.js";
import type { SignedUrlDto } from "../../types/files.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import { getDailyLogAssignmentForCarer } from "./access.js";
import { dailyLogAssignmentIdFromPath } from "./paths.js";

export async function createSignedDownloadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { bucket: string; path: string; expiresIn?: number },
) {
  const bucket = input.bucket?.trim();
  const path = input.path?.trim().replace(/^\/+/, "");
  const expiresIn = input.expiresIn ?? DEFAULT_SIGNED_URL_EXPIRES_SECONDS;

  if (!bucket || !path) {
    return serviceFailure({ badRequest: true });
  }

  if (!isAllowedStorageBucket(bucket)) {
    return serviceFailure({ badRequest: true });
  }

  if (bucket === STORAGE_BUCKETS.DAILY_LOGS) {
    const assignmentId = dailyLogAssignmentIdFromPath(path);
    if (!assignmentId) {
      return serviceFailure({ forbidden: true });
    }

    const access = await getDailyLogAssignmentForCarer(
      supabase,
      userId,
      assignmentId,
    );
    if (access.error) {
      return serviceFailure({ error: access.error });
    }
    if (access.forbidden || !access.assignment) {
      return serviceFailure({ forbidden: true });
    }
  }

  if (bucket === STORAGE_BUCKETS.DOCUMENTS) {
    const assigneeAccess = await findDocumentAccessibleByPath(
      supabase,
      userId,
      path,
    );
    if (assigneeAccess.error) {
      return serviceFailure({ error: assigneeAccess.error });
    }

    if (!assigneeAccess.data) {
      const childDocAccess = await authorizeChildDocumentDownload(
        supabase,
        userId,
        path,
      );
      if (childDocAccess.error) {
        return serviceFailure({ error: childDocAccess.error });
      }
      if (!childDocAccess.allowed) {
        return serviceFailure({ forbidden: true });
      }
    }
  }

  if (bucket === STORAGE_BUCKETS.ATTACHMENTS) {
    const ticketAccess = await authorizeTicketAttachmentDownload(
      supabase,
      userId,
      path,
    );
    if (ticketAccess.error) {
      return serviceFailure({ error: ticketAccess.error });
    }
    if (!ticketAccess.allowed) {
      return serviceFailure({ forbidden: true });
    }
  }

  if (bucket === STORAGE_BUCKETS.EXPENSE_ATTACHMENTS) {
    const expenseAccess = await authorizeExpenseAttachmentDownload(
      supabase,
      userId,
      path,
    );
    if (expenseAccess.error) {
      return serviceFailure({ error: expenseAccess.error });
    }
    if (!expenseAccess.allowed) {
      return serviceFailure({ forbidden: true });
    }
  }

  const { data, error } = await createStorageSignedDownloadUrl(
    supabase,
    bucket,
    path,
    expiresIn,
  );

  if (error || !data?.signedUrl) {
    const message = String(
      (error as { message?: string } | null)?.message ?? "",
    ).toLowerCase();
    const statusCode = String(
      (error as { statusCode?: string | number; status?: number } | null)
        ?.statusCode ??
        (error as { status?: number } | null)?.status ??
        "",
    );

    const objectMissing =
      message.includes("not found") ||
      message.includes("object not found") ||
      statusCode === "404" ||
      statusCode === "400";

    if (objectMissing && message.includes("not found")) {
      return serviceFailure({
        error: error ?? new Error("Object not found"),
        notFound: true,
      });
    }

    return serviceFailure({
      error: error ?? new Error("Failed to create signed URL"),
    });
  }

  return serviceSuccess<SignedUrlDto>({
    bucket,
    path,
    signedUrl: data.signedUrl,
    expiresIn,
  });
}

async function authorizeChildDocumentDownload(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<{ allowed: boolean; error: Error | null }> {
  const { data, error } = await findChildDocumentByStoragePath(supabase, path);
  if (error) {
    return { allowed: false, error };
  }
  if (!data?.child_id) {
    return { allowed: false, error: null };
  }

  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { allowed: false, error: householdError };
  }

  const { allowed, error: accessError } = await assertChildAccessibleToCarer(
    supabase,
    data.child_id,
    householdIds,
  );
  if (accessError) {
    return { allowed: false, error: accessError };
  }

  return { allowed, error: null };
}

async function authorizeTicketAttachmentDownload(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<{ allowed: boolean; error: Error | null }> {
  // Own upload path before ticket row exists (create flow).
  if (path.startsWith(`${userId}/`)) {
    return { allowed: true, error: null };
  }

  const { data, error } = await findTicketAttachmentByPath(supabase, path);
  if (error) return { allowed: false, error };
  if (!data) return { allowed: false, error: null };

  const ticket = await findTicketByIdForCreator(
    supabase,
    data.ticket_id,
    userId,
  );
  if (ticket.error) return { allowed: false, error: ticket.error };
  return { allowed: ticket.data != null, error: null };
}

async function authorizeExpenseAttachmentDownload(
  supabase: SupabaseClient,
  userId: string,
  path: string,
): Promise<{ allowed: boolean; error: Error | null }> {
  if (path.startsWith(`${userId}/`)) {
    return { allowed: true, error: null };
  }

  const { data, error } = await findExpenseAttachmentByPath(supabase, path);
  if (error) return { allowed: false, error };
  if (!data) return { allowed: false, error: null };

  const claim = await findExpenseClaimByIdForCarer(
    supabase,
    data.expense_claim_id,
    userId,
  );
  if (claim.error) return { allowed: false, error: claim.error };
  return { allowed: claim.data != null, error: null };
}
