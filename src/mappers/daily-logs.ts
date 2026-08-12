import { toDateOnly } from "../lib/dates.js";
import { isDailyLogEditable, isDailyLogOverdue } from "../lib/daily-log-status.js";
import { isPlainObject } from "../lib/objects.js";
import type {
  DailyLogAssignmentDetailRow,
  DailyLogAssignmentListRow,
  DailyLogContributorDto,
  DailyLogDetailDto,
  DailyLogDetailLogDto,
  DailyLogDetailLogRow,
  DailyLogListItemDto,
  DailyLogSummaryRow,
  DailyLogTemplateDetailDto,
  DailyLogTemplateDetailRow,
  DailyLogTemplateSummaryRow,
} from "../types/daily-logs.js";

function firstOrNull<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function asObject(value: unknown): Record<string, unknown> {
  return isPlainObject(value) ? value : {};
}

export function toDailyLogListItemDto(
  row: DailyLogAssignmentListRow,
  subjectName: string | null,
): DailyLogListItemDto {
  const template = firstOrNull<DailyLogTemplateSummaryRow>(
    row.daily_log_templates,
  );
  const log = firstOrNull<DailyLogSummaryRow>(row.daily_logs);
  const editOptions = {
    assignedDate: row.assigned_date,
    logStatus: log?.status,
    assignmentStatus: row.status,
  };

  return {
    id: row.id,
    assignedDate: row.assigned_date,
    assignmentStatus: row.status,
    status: log?.status ?? row.status ?? "pending",
    assignmentSubject: row.assignment_subject ?? "child",
    childId: row.child_id,
    biologicalParentId: row.biological_parent_id,
    householdId: row.household_id,
    dueTime: row.due_time,
    completedAt: row.completed_at,
    subjectName,
    canEdit: isDailyLogEditable(editOptions),
    isOverdue: isDailyLogOverdue(editOptions),
    template: template ? { id: template.id, name: template.name } : null,
    log: log ? { id: log.id, status: log.status } : null,
  };
}

export function pickLogForAssignment(
  row: DailyLogAssignmentDetailRow,
): DailyLogDetailLogRow | null {
  const logs = Array.isArray(row.daily_logs)
    ? row.daily_logs
    : row.daily_logs
      ? [row.daily_logs]
      : [];

  if (logs.length === 0) return null;

  const assignedDate = toDateOnly(row.assigned_date);

  const byAssignmentId = logs.find((log) => log.assignment_id === row.id);
  if (byAssignmentId) return byAssignmentId;

  const byDate = logs.find(
    (log) => toDateOnly(log.date) === assignedDate,
  );
  if (byDate) return byDate;

  return logs[0] ?? null;
}

function toTemplateDetailDto(
  row: DailyLogTemplateDetailRow | null,
): DailyLogTemplateDetailDto | null {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    templateFields: row.template_fields ?? [],
  };
}

function toLogDetailDto(row: DailyLogDetailLogRow | null): DailyLogDetailLogDto | null {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    date: row.date,
    dataJson: asObject(row.data_json),
    isSensitive: row.is_sensitive === true,
    childId: row.child_id,
    biologicalParentId: row.biological_parent_id,
    updatedAt: row.updated_at,
  };
}

export function toDailyLogDetailDto(
  row: DailyLogAssignmentDetailRow,
  subjectName: string | null,
  contributors: DailyLogContributorDto[] = [],
): DailyLogDetailDto {
  const template = firstOrNull<DailyLogTemplateDetailRow>(
    row.daily_log_templates,
  );
  const log = pickLogForAssignment(row);
  const editOptions = {
    assignedDate: row.assigned_date,
    logStatus: log?.status,
    assignmentStatus: row.status,
  };

  return {
    id: row.id,
    assignedDate: row.assigned_date,
    assignmentStatus: row.status,
    status: log?.status ?? row.status ?? "pending",
    assignmentSubject: row.assignment_subject ?? "child",
    childId: row.child_id,
    biologicalParentId: row.biological_parent_id,
    householdId: row.household_id,
    dueTime: row.due_time,
    completedAt: row.completed_at,
    subjectName,
    canEdit: isDailyLogEditable(editOptions),
    isOverdue: isDailyLogOverdue(editOptions),
    template: toTemplateDetailDto(template),
    log: toLogDetailDto(log),
    contributors,
  };
}
