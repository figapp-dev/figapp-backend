import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  DEFAULT_SIGNED_URL_EXPIRES_SECONDS,
  STORAGE_BUCKETS,
  isAllowedStorageBucket,
} from "../../lib/storage.js";
import { createSignedDownloadUrl as createStorageSignedDownloadUrl } from "../../repositories/files.js";
import type { SignedUrlDto } from "../../types/files.js";
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
