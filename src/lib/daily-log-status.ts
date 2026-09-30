import { getTodayUKDateString, toDateOnly } from "./dates.js";

export type DailyLogIntent = "save" | "submit";

export function isCompletedOrSubmitted(
  status: string | null | undefined,
): boolean {
  const value = String(status ?? "")
    .trim()
    .toLowerCase();
  return value === "completed" || value === "submitted";
}

function isCompletedDisplay(options: {
  logStatus: string | null | undefined;
  assignmentStatus: string | null | undefined;
}): boolean {
  return (
    isCompletedOrSubmitted(options.logStatus) ||
    String(options.assignmentStatus ?? "")
      .trim()
      .toLowerCase() === "completed"
  );
}

/**
 * Completed logs are editable only on the assigned UK calendar date.
 * Matches figapp-new isDailyLogAssignmentEditable.
 */
export function isDailyLogEditable(options: {
  assignedDate: string | null | undefined;
  logStatus: string | null | undefined;
  assignmentStatus: string | null | undefined;
}): boolean {
  if (!isCompletedDisplay(options)) return true;

  const assignedDate = toDateOnly(options.assignedDate);
  if (!assignedDate) return false;

  return assignedDate === getTodayUKDateString();
}

/**
 * social_worker/sw_manager are review-only for daily logs — never allowed
 * to edit, regardless of the log's own status/date. Every other role keeps
 * today's date/status-driven isDailyLogEditable result.
 */
export function canRoleEditDailyLogs(role: string | null | undefined): boolean {
  return role !== "social_worker" && role !== "sw_manager";
}

/**
 * Overdue only after the assigned UK calendar day has passed.
 * Same-day logs are never overdue (due_time ignored). Matches web.
 */
export function isDailyLogOverdue(options: {
  assignedDate: string | null | undefined;
  logStatus: string | null | undefined;
  assignmentStatus: string | null | undefined;
}): boolean {
  if (isCompletedDisplay(options)) return false;

  const assignedDate = toDateOnly(options.assignedDate);
  if (!assignedDate) return false;

  return assignedDate < getTodayUKDateString();
}
