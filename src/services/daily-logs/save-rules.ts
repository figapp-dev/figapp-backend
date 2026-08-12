import { isCompletedOrSubmitted } from "../../lib/daily-log-status.js";
import { getTodayUKDateString, toDateOnly } from "../../lib/dates.js";
import type {
  DailyLogAssignmentDetailRow,
  DailyLogDetailLogRow,
  SaveDailyLogBody,
  SaveDailyLogIntent,
} from "../../types/daily-logs.js";

export function parseSaveIntent(
  intent: SaveDailyLogBody["intent"],
): SaveDailyLogIntent {
  return intent === "submit" ? "submit" : "save";
}

export function resolveNextLogStatus(
  intent: SaveDailyLogIntent,
  existingStatus: string | null | undefined,
): string {
  if (intent === "submit") return "completed";
  if (existingStatus && isCompletedOrSubmitted(existingStatus)) {
    return existingStatus;
  }
  return "in_progress";
}

export function buildDailyLogWritePayload(options: {
  row: DailyLogAssignmentDetailRow;
  body: SaveDailyLogBody;
  intent: SaveDailyLogIntent;
  userId: string;
  existingLog: DailyLogDetailLogRow | null;
  nowIso: string;
}): Record<string, unknown> {
  const { row, body, intent, userId, existingLog, nowIso } = options;
  const assignedDate = toDateOnly(row.assigned_date) ?? "";

  const logPayload: Record<string, unknown> = {
    child_id: row.child_id,
    biological_parent_id: row.biological_parent_id,
    assignment_id: row.id,
    template_id: row.template_id,
    author_id: userId,
    date: assignedDate || getTodayUKDateString(),
    data_json: body.dataJson,
    status: resolveNextLogStatus(intent, existingLog?.status),
    household_id: row.household_id,
    updated_at: nowIso,
  };

  if (typeof body.isSensitive === "boolean") {
    logPayload.is_sensitive = body.isSensitive;
  }

  if (intent === "submit") {
    logPayload.submitted_by = userId;
    logPayload.submitted_at = nowIso;
  }

  if (!existingLog?.id && body.clientLogId?.trim()) {
    logPayload.id = body.clientLogId.trim();
  }

  return logPayload;
}

/**
 * Same-day save of an already-completed assignment leaves status as completed.
 * Submit / first-time save / in-progress still write assignment status.
 */
export function shouldUpdateAssignmentStatus(
  intent: SaveDailyLogIntent,
  assignmentStatus: string | null | undefined,
): boolean {
  if (intent === "save") {
    const current = String(assignmentStatus ?? "")
      .trim()
      .toLowerCase();
    if (current === "completed") return false;
  }
  return true;
}

export function buildAssignmentUpdate(
  intent: SaveDailyLogIntent,
  nowIso: string,
): Record<string, unknown> {
  if (intent === "submit") {
    return { status: "completed", completed_at: nowIso };
  }
  return { status: "in_progress" };
}

export function templateFieldsFromAssignment(
  row: DailyLogAssignmentDetailRow,
): unknown {
  const templateRow = Array.isArray(row.daily_log_templates)
    ? (row.daily_log_templates[0] ?? null)
    : row.daily_log_templates;
  return templateRow?.template_fields;
}
