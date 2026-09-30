import type { SupabaseClient } from "@supabase/supabase-js";
import { isCompletedOrSubmitted } from "../../lib/daily-log-status.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { pickLogForAssignment } from "../../mappers/daily-logs.js";
import {
  findAssignmentForHouseholds,
  updateDailyLog,
} from "../../repositories/daily-logs.js";
import { resolveSupervisoryScope } from "../foster-carers/common.js";
import { canToggleDailyLogSensitivity } from "./sensitivity-window.js";

/**
 * The one mutation a social_worker/sw_manager has on a caseload member's
 * daily log — everything else about the log stays read-only for them (see
 * docs/adr-multi-role-mobile-support.md § 6's answered "review" question).
 * Deliberately separate from PUT /daily-logs/:id (save/submit), which stays
 * foster_carer-only and is not widened for this role.
 */
export async function toggleDailyLogSensitivityForStaff(
  supabase: SupabaseClient,
  callerUserId: string,
  assignmentId: string,
  isSensitive: boolean,
) {
  const { scope, failure } = await resolveSupervisoryScope(supabase, callerUserId);
  if (failure) return failure;

  const { householdIds } = scope!;
  if (householdIds.length === 0) {
    return serviceFailure({ notFound: true });
  }

  const { data: row, error: assignmentError } = await findAssignmentForHouseholds(
    supabase,
    assignmentId,
    householdIds,
  );
  if (assignmentError) return serviceFailure({ error: assignmentError });
  if (!row) return serviceFailure({ notFound: true });

  const log = pickLogForAssignment(row);
  if (!log) {
    // No daily_logs row exists yet (assignment still fully unstarted) —
    // nothing to mark sensitive on. Distinct from notFound: the assignment
    // itself is real and in scope, there's just no log row to act on yet.
    return serviceFailure({ notStarted: true });
  }

  const isCompleted =
    isCompletedOrSubmitted(log.status) || isCompletedOrSubmitted(row.status);
  const allowed = canToggleDailyLogSensitivity({
    isCompleted,
    completedAtIso: row.completed_at,
  });
  if (!allowed) {
    return serviceFailure({ notEditable: true });
  }

  const updatedAt = new Date().toISOString();
  const { error: updateError } = await updateDailyLog(supabase, log.id, {
    is_sensitive: isSensitive,
    updated_at: updatedAt,
  });
  if (updateError) return serviceFailure({ error: updateError });

  return serviceSuccess({ isSensitive, updatedAt });
}
