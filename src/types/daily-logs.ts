export type DailyLogListItemDto = {
  id: string; // assignment id
  assignedDate: string;
  status: string; // display status you’ll derive later
  assignmentStatus: string | null;
  assignmentSubject: "child" | "placed_parent" | string;
  childId: string | null;
  biologicalParentId: string | null;
  householdId: string | null;
  dueTime: string | null;
  completedAt: string | null;
  subjectName: string | null; // child display name or parent name
  /** Completed logs: true only on assigned UK date. Enforced again on PUT. */
  canEdit: boolean;
  /** True when assigned UK date is before today and not completed. */
  isOverdue: boolean;
  template: { id: string; name: string } | null;
  log: { id: string; status: string | null } | null;
};

export type DailyLogsListDto = {
  items: DailyLogListItemDto[];
};

export type DailyLogTemplateSummaryRow = {
  id: string;
  name: string;
};

export type DailyLogSummaryRow = {
  id: string;
  status: string | null;
};

export type DailyLogAssignmentListRow = {
  id: string;
  assigned_date: string;
  status: string | null;
  assignment_subject: string | null;
  child_id: string | null;
  biological_parent_id: string | null;
  household_id: string | null;
  due_time: string | null;
  completed_at: string | null;
  daily_log_templates:
    | DailyLogTemplateSummaryRow
    | DailyLogTemplateSummaryRow[]
    | null;
  daily_logs: DailyLogSummaryRow | DailyLogSummaryRow[] | null;
};

export type DailyLogTemplateDetailDto = {
  id: string;
  name: string;
  templateFields: unknown;
};

export type DailyLogDetailLogDto = {
  id: string;
  status: string | null;
  date: string | null;
  dataJson: Record<string, unknown>;
  isSensitive: boolean;
  childId: string | null;
  biologicalParentId: string | null;
  /** ISO timestamp for offline optimistic locking. */
  updatedAt: string | null;
};

export type DailyLogContributorDto = {
  id: string;
  contributorId: string;
  displayName: string;
  contributedAt: string | null;
  lastEditAt: string;
};

export type DailyLogDetailDto = {
  id: string; // assignment id
  assignedDate: string;
  status: string;
  assignmentStatus: string | null;
  assignmentSubject: "child" | "placed_parent" | string;
  childId: string | null;
  biologicalParentId: string | null;
  householdId: string | null;
  dueTime: string | null;
  completedAt: string | null;
  subjectName: string | null;
  educationArrangement: string | null;
  /** Completed logs: true only on assigned UK date. Enforced again on PUT. */
  canEdit: boolean;
  /** True when assigned UK date is before today and not completed. */
  isOverdue: boolean;
  template: DailyLogTemplateDetailDto | null;
  log: DailyLogDetailLogDto | null;
  contributors: DailyLogContributorDto[];
};

export type DailyLogTemplateDetailRow = {
  id: string;
  name: string;
  template_fields: unknown;
};

export type DailyLogDetailLogRow = {
  id: string;
  status: string | null;
  date: string | null;
  assignment_id: string | null;
  data_json: unknown;
  child_id: string | null;
  biological_parent_id: string | null;
  is_sensitive: boolean | null;
  updated_at: string | null;
};

export type DailyLogAssignmentDetailRow = {
  id: string;
  assigned_date: string;
  status: string | null;
  assignment_subject: string | null;
  child_id: string | null;
  biological_parent_id: string | null;
  household_id: string | null;
  due_time: string | null;
  completed_at: string | null;
  template_id: string | null;
  daily_log_templates:
    | DailyLogTemplateDetailRow
    | DailyLogTemplateDetailRow[]
    | null;
  daily_logs: DailyLogDetailLogRow | DailyLogDetailLogRow[] | null;
};

export type SaveDailyLogIntent = "save" | "submit";

export type SaveDailyLogBody = {
  /** Full answers map (fieldId → value). Replaces data_json. */
  dataJson: Record<string, unknown>;
  /**
   * save = draft / autosave (partial OK)
   * submit = mark completed (server checks required template fields)
   */
  intent?: SaveDailyLogIntent;
  isSensitive?: boolean;
  /** Optional client-generated UUID for offline-safe create. */
  clientLogId?: string;
  /**
   * Optional optimistic lock. When the log already exists, Flutter should send
   * the `log.updatedAt` from the last GET/PUT. Mismatch → 409 CONFLICT.
   */
  expectedUpdatedAt?: string;
};
