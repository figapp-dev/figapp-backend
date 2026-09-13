import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { STORAGE_BUCKETS } from "../../lib/storage.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { createSignedUploadUrl } from "../../repositories/files.js";
import {
  findAgencyIdForUser,
  findOwnParticipant,
} from "../../repositories/figchat.js";
import { findExpenseClaimByIdForCarer } from "../../repositories/expenses.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import { isLifeStorySectionKey } from "../../types/life-story.js";
import type {
  CreateFileUploadDto,
  FileResource,
} from "../../types/files.js";
import { getDailyLogAssignmentForCarer } from "./access.js";
import {
  buildChildDocumentStoragePath,
  buildDailyLogStoragePath,
  buildFigChatStoragePath,
  buildLifeStoryStoragePath,
  sanitizeFileName,
} from "./paths.js";

async function createDailyLogUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; fieldId: string; fileName: string },
) {
  const id = input.id.trim();
  const fieldId = input.fieldId.trim();
  const fileName = sanitizeFileName(input.fileName);

  const access = await getDailyLogAssignmentForCarer(supabase, userId, id);
  if (access.error) {
    return serviceFailure({ error: access.error });
  }
  if (access.forbidden || !access.assignment) {
    return serviceFailure({ forbidden: true });
  }

  const path = buildDailyLogStoragePath({
    assignment: access.assignment,
    fieldId,
    fileName,
  });

  const { data, error } = await createSignedUploadUrl(
    supabase,
    STORAGE_BUCKETS.DAILY_LOGS,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "daily_log",
    id,
    bucket: STORAGE_BUCKETS.DAILY_LOGS,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}

async function createFigChatUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; fileName: string },
) {
  const conversationId = input.id.trim();
  const fileName = sanitizeFileName(input.fileName);

  const participant = await findOwnParticipant(supabase, conversationId, userId);
  if (participant.error) {
    return serviceFailure({ error: participant.error });
  }
  if (!participant.data || participant.data.archived) {
    return serviceFailure({ forbidden: true });
  }

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) {
    return serviceFailure({ error: agency.error });
  }
  if (!agency.agencyId) {
    return serviceFailure({
      error: new Error(
        `FigChat upload: no agency_users row found for sender ${userId}`,
      ),
    });
  }

  const path = buildFigChatStoragePath({
    agencyId: agency.agencyId,
    conversationId,
    fileName,
  });

  const { data, error } = await createSignedUploadUrl(
    supabase,
    STORAGE_BUCKETS.FIGCHAT,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "figchat",
    id: conversationId,
    bucket: STORAGE_BUCKETS.FIGCHAT,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}

async function createLifeStoryUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; section: string; fileName: string },
) {
  const childId = input.id.trim();
  const section = input.section.trim();
  const fileName = sanitizeFileName(input.fileName);

  if (!isLifeStorySectionKey(section)) {
    return serviceFailure({ badRequest: true });
  }

  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return serviceFailure({ error: householdError });
  }

  const { allowed, error: accessError } = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (accessError) {
    return serviceFailure({ error: accessError });
  }
  if (!allowed) {
    return serviceFailure({ forbidden: true });
  }

  const path = buildLifeStoryStoragePath({
    userId,
    childId,
    section,
    fileName,
  });

  const { data, error } = await createSignedUploadUrl(
    supabase,
    STORAGE_BUCKETS.LIFE_STORY,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "life_story",
    id: childId,
    bucket: STORAGE_BUCKETS.LIFE_STORY,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}

export async function createFileUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: {
    resource: FileResource | string;
    id: string;
    fieldId?: string;
    section?: string;
    fileName: string;
  },
) {
  const resource = input.resource?.trim();
  const id = input.id?.trim();
  const fileNameRaw = input.fileName?.trim();

  if (!resource || !id || !fileNameRaw) {
    return serviceFailure({ badRequest: true });
  }

  if (resource === "daily_log") {
    const fieldId = input.fieldId?.trim();
    if (!fieldId) {
      return serviceFailure({ badRequest: true });
    }

    return createDailyLogUploadUrl(supabase, userId, {
      id,
      fieldId,
      fileName: fileNameRaw,
    });
  }

  if (resource === "figchat") {
    return createFigChatUploadUrl(supabase, userId, { id, fileName: fileNameRaw });
  }

  if (resource === "life_story") {
    const section = input.section?.trim();
    if (!section) {
      return serviceFailure({ badRequest: true });
    }

    return createLifeStoryUploadUrl(supabase, userId, {
      id,
      section,
      fileName: fileNameRaw,
    });
  }

  if (resource === "child_document") {
    return createChildDocumentUploadUrl(supabase, userId, {
      id,
      fileName: fileNameRaw,
    });
  }

  if (resource === "ticket") {
    return createTicketUploadUrl(supabase, userId, {
      fileName: fileNameRaw,
    });
  }

  if (resource === "expense") {
    return createExpenseUploadUrl(supabase, userId, {
      claimId: id,
      fileName: fileNameRaw,
    });
  }

  return serviceFailure({ unsupported: true });
}

async function createTicketUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { fileName: string },
) {
  const fileName = sanitizeFileName(input.fileName);
  const path = `${userId}/${randomUUID()}_${fileName}`;

  const { data, error } = await createSignedUploadUrl(
    supabase,
    STORAGE_BUCKETS.ATTACHMENTS,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "ticket",
    id: userId,
    bucket: STORAGE_BUCKETS.ATTACHMENTS,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}

async function createExpenseUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { claimId: string; fileName: string },
) {
  const claimId = input.claimId.trim();
  if (!claimId) {
    return serviceFailure({ badRequest: true });
  }

  // Authz with the user client first. Storage RLS on expense-attachments can
  // reject createSignedUploadUrl even when the carer owns the claim (nested
  // policy checks), so mint the URL with the service role after that check —
  // same pattern as other privileged backend writes.
  const existing = await findExpenseClaimByIdForCarer(supabase, claimId, userId);
  if (existing.error) {
    return serviceFailure({ error: existing.error });
  }
  if (!existing.data) {
    return serviceFailure({ forbidden: true });
  }

  const fileName = sanitizeFileName(input.fileName);
  const path = `${claimId}/${randomUUID()}_${fileName}`;

  let admin: SupabaseClient;
  try {
    admin = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  const { data, error } = await createSignedUploadUrl(
    admin,
    STORAGE_BUCKETS.EXPENSE_ATTACHMENTS,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "expense",
    id: claimId,
    bucket: STORAGE_BUCKETS.EXPENSE_ATTACHMENTS,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}

async function createChildDocumentUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: { id: string; fileName: string },
) {
  const childId = input.id.trim();
  const fileName = sanitizeFileName(input.fileName);

  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return serviceFailure({ error: householdError });
  }

  const { allowed, error: accessError } = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (accessError) {
    return serviceFailure({ error: accessError });
  }
  if (!allowed) {
    return serviceFailure({ forbidden: true });
  }

  const path = buildChildDocumentStoragePath({
    userId,
    childId,
    fileName,
  });

  const { data, error } = await createSignedUploadUrl(
    supabase,
    STORAGE_BUCKETS.DOCUMENTS,
    path,
    { upsert: true },
  );

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create signed upload URL"),
    });
  }

  return serviceSuccess<CreateFileUploadDto>({
    resource: "child_document",
    id: childId,
    bucket: STORAGE_BUCKETS.DOCUMENTS,
    path: data.path,
    token: data.token,
    signedUrl: data.signedUrl,
    fileName,
  });
}
