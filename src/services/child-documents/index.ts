import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import { findAgencyIdForUser } from "../../repositories/figchat.js";
import {
  insertChildDocument,
  listChildDocuments,
} from "../../repositories/child-documents.js";
import { toChildDocumentDto } from "../../mappers/child-documents.js";
import { isChildDocumentPathForUploader } from "../files/paths.js";
import type {
  ChildDocumentDto,
  ChildDocumentsListDto,
  CreateChildDocumentBody,
} from "../../types/child-documents.js";

export async function listChildDocumentsForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
) {
  const id = childId.trim();
  if (!id) {
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
    id,
    householdIds,
  );
  if (accessError) {
    return serviceFailure({ error: accessError });
  }
  if (!allowed) {
    return serviceFailure({ forbidden: true });
  }

  const { data, error } = await listChildDocuments(supabase, id);
  if (error) {
    return serviceFailure({ error });
  }

  const documents = data
    .map(toChildDocumentDto)
    .filter((doc): doc is ChildDocumentDto => doc != null);

  return serviceSuccess<ChildDocumentsListDto>({
    childId: id,
    documents,
  });
}

export async function createChildDocumentForCarer(
  supabase: SupabaseClient,
  userId: string,
  childId: string,
  body: CreateChildDocumentBody,
) {
  const id = childId.trim();
  const title = body.title?.trim() ?? "";
  const filePath = body.filePath?.trim().replace(/^\/+/, "") ?? "";

  if (!id || !title || !filePath) {
    return serviceFailure({ badRequest: true });
  }

  if (!isChildDocumentPathForUploader(filePath, userId, id)) {
    return serviceFailure({ forbidden: true });
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
    id,
    householdIds,
  );
  if (accessError) {
    return serviceFailure({ error: accessError });
  }
  if (!allowed) {
    return serviceFailure({ forbidden: true });
  }

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) {
    return serviceFailure({ error: agency.error });
  }
  if (!agency.agencyId) {
    return serviceFailure({
      error: new Error(`Child document upload: no agency for user ${userId}`),
    });
  }

  const fileType = body.fileType?.trim() || null;
  const fileSizeBytes =
    typeof body.fileSizeBytes === "number" && Number.isFinite(body.fileSizeBytes)
      ? Math.max(0, Math.floor(body.fileSizeBytes))
      : null;

  const { data, error } = await insertChildDocument(supabase, {
    agencyId: agency.agencyId,
    childId: id,
    userId,
    title,
    filePath,
    fileType,
    fileSizeBytes,
  });

  if (error || !data) {
    return serviceFailure({
      error: error ?? new Error("Failed to create child document"),
    });
  }

  const dto = toChildDocumentDto(data);
  if (!dto) {
    return serviceFailure({ error: new Error("Invalid child document row") });
  }

  return serviceSuccess<ChildDocumentDto>(dto);
}
