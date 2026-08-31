import type { SupabaseClient } from "@supabase/supabase-js";
import { isDailyLogEditable } from "../../lib/daily-log-status.js";
import { validateDailyLogSubmit } from "../../lib/daily-log-validation.js";
import { timestampsMatch } from "../../lib/dates.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import { isPlainObject } from "../../lib/objects.js";
import { insertParentingAssessmentSection } from "../../lib/parenting-assessment.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { pickLogForAssignment } from "../../mappers/daily-logs.js";
import {
  findAssignmentForHouseholds,
  insertDailyLog,
  updateAssignment,
  updateDailyLog,
} from "../../repositories/daily-logs.js";
import type {
  DailyLogAssignmentDetailRow,
  DailyLogDetailDto,
  DailyLogDetailLogRow,
  SaveDailyLogBody,
  SaveDailyLogIntent,
} from "../../types/daily-logs.js";
import { upsertContributorForSave } from "./contributors.js";
import { getDailyLogForCarer } from "./detail.js";
import { loadParentingAssessmentSection } from "./parenting-assessment.js";
import { loadEducationArrangement } from "./subjects.js";
import {
  buildAssignmentUpdate,
  buildDailyLogWritePayload,
  parseSaveIntent,
  shouldUpdateAssignmentStatus,
  templateFieldsFromAssignment,
} from "./save-rules.js";

export type SaveDailyLogResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<typeof serviceSuccess<DailyLogDetailDto>>);

/**
 * Orchestrates save/submit: validate → authorize → persist log →
 * contributors → assignment status → return refreshed detail.
 */
export async function saveDailyLogForCarer(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  body: SaveDailyLogBody,
): Promise<SaveDailyLogResult> {
  const intent = parseSaveIntent(body.intent);

  const bodyError = validateSaveRequestBody(body, intent);
  if (bodyError) return bodyError;

  const loaded = await loadEditableAssignment(
    supabase,
    userId,
    assignmentId,
    body.expectedUpdatedAt,
  );
  if ("failure" in loaded) return loaded.failure;

  const { row, existingLog } = loaded;

  if (intent === "submit") {
    const educationArrangement = await loadEducationArrangement(
      supabase,
      row.child_id,
    );
    const parentingAssessmentSection = await loadParentingAssessmentSection(
      supabase,
      row,
    );
    const templateFields = insertParentingAssessmentSection(
      templateFieldsFromAssignment(row),
      parentingAssessmentSection,
    );
    const validation = validateDailyLogSubmit(
      body.dataJson,
      templateFields,
      educationArrangement,
    );
    if (!validation.ok) {
      return serviceFailure({
        validationFailed: true,
        missingFieldIds: validation.missingFieldIds,
      });
    }
  }

  const nowIso = new Date().toISOString();
  const logPayload = buildDailyLogWritePayload({
    row,
    body,
    intent,
    userId,
    existingLog,
    nowIso,
  });

  const written = await writeDailyLog(supabase, existingLog?.id ?? null, logPayload);
  if (written.failure) return written.failure;

  if (written.logId) {
    await upsertContributorForSave(
      supabase,
      written.logId,
      userId,
      body.dataJson,
      nowIso,
    );
  }

  if (shouldUpdateAssignmentStatus(intent, row.status)) {
    const { error } = await updateAssignment(
      supabase,
      row.id,
      buildAssignmentUpdate(intent, nowIso),
    );
    if (error) return serviceFailure({ error });
  }

  return refreshDetail(supabase, userId, assignmentId);
}

function validateSaveRequestBody(
  body: SaveDailyLogBody,
  intent: SaveDailyLogIntent,
): ReturnType<typeof serviceFailure> | null {
  if (!isPlainObject(body.dataJson)) {
    return serviceFailure({ badRequest: true });
  }
  if (intent === "submit" && Object.keys(body.dataJson).length === 0) {
    return serviceFailure({ submitEmpty: true });
  }
  return null;
}

async function loadEditableAssignment(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
  expectedUpdatedAt: string | null | undefined,
): Promise<
  | {
      row: DailyLogAssignmentDetailRow;
      existingLog: DailyLogDetailLogRow | null;
    }
  | { failure: ReturnType<typeof serviceFailure> }
> {
  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) {
    return { failure: serviceFailure({ error: householdError }) };
  }
  if (householdIds.length === 0) {
    return { failure: serviceFailure({ notFound: true }) };
  }

  const { data: row, error: assignmentError } = await findAssignmentForHouseholds(
    supabase,
    assignmentId,
    householdIds,
  );

  if (assignmentError) {
    return { failure: serviceFailure({ error: assignmentError }) };
  }
  if (!row) {
    return { failure: serviceFailure({ notFound: true }) };
  }

  const existingLog = pickLogForAssignment(row);

  if (
    !isDailyLogEditable({
      assignedDate: row.assigned_date,
      logStatus: existingLog?.status,
      assignmentStatus: row.status,
    })
  ) {
    return { failure: serviceFailure({ notEditable: true }) };
  }

  if (existingLog) {
    if (
      expectedUpdatedAt == null ||
      String(expectedUpdatedAt).trim() === ""
    ) {
      return {
        failure: serviceFailure({
          missingLock: true,
          currentUpdatedAt: existingLog.updated_at,
        }),
      };
    }
    if (!timestampsMatch(expectedUpdatedAt, existingLog.updated_at)) {
      return {
        failure: serviceFailure({
          conflict: true,
          currentUpdatedAt: existingLog.updated_at,
        }),
      };
    }
  }

  return { row, existingLog };
}

async function writeDailyLog(
  supabase: SupabaseClient,
  existingLogId: string | null,
  logPayload: Record<string, unknown>,
): Promise<
  | { logId: string | null; failure?: undefined }
  | { failure: ReturnType<typeof serviceFailure>; logId?: undefined }
> {
  if (existingLogId) {
    const { error } = await updateDailyLog(supabase, existingLogId, logPayload);
    if (error) return { failure: serviceFailure({ error }) };
    return { logId: existingLogId };
  }

  const { id, error } = await insertDailyLog(supabase, logPayload);
  if (error) return { failure: serviceFailure({ error }) };
  return { logId: id };
}

async function refreshDetail(
  supabase: SupabaseClient,
  userId: string,
  assignmentId: string,
): Promise<SaveDailyLogResult> {
  const refreshed = await getDailyLogForCarer(supabase, userId, assignmentId);
  if (refreshed.error) {
    return serviceFailure({ error: refreshed.error });
  }
  if (!refreshed.data) {
    return serviceFailure({ notFound: true });
  }
  return serviceSuccess(refreshed.data);
}
