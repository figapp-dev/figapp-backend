import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { STORAGE_BUCKETS } from "../../lib/storage.js";
import { createSignedUploadUrl } from "../../repositories/files.js";
import {
  findAgencyIdForUser,
  findOwnParticipant,
} from "../../repositories/figchat.js";
import type {
  CreateFileUploadDto,
  FileResource,
} from "../../types/files.js";
import { getDailyLogAssignmentForCarer } from "./access.js";
import {
  buildDailyLogStoragePath,
  buildFigChatStoragePath,
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

export async function createFileUploadUrl(
  supabase: SupabaseClient,
  userId: string,
  input: {
    resource: FileResource | string;
    id: string;
    fieldId?: string;
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

  return serviceFailure({ unsupported: true });
}
