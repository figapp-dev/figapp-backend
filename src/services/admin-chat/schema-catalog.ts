/**
 * The curated table allowlist for Ask Figgy (see docs/adr-agency-admin-chat-assistant.md).
 * This is the single source of truth for both what Claude is told exists
 * (the tool description below) and what the query validator will accept —
 * adding a table means adding one entry here, nothing else.
 *
 * v1 only includes tables with a direct agency_id column, so the validator's
 * "always force agency_id" rule needs no per-table join logic.
 */

export type AdminChatTableDef = {
  table: string;
  description: string;
  /** Columns Claude may read (`list` aggregation) or ask for a count of. */
  columns: string[];
  /** Columns Claude may filter on. agency_id is forced separately — never listed here. */
  filterableColumns: string[];
  /** Date/timestamp columns Claude may filter as an inclusive range (e.g. "last week", "this month"). */
  dateRangeColumns: string[];
  /** Plural label for a count-stat card (e.g. "daily log assignments"). Defaults to the table name with underscores spaced out. */
  displayLabel?: string;
  /**
   * Known real values for filterable columns whose meaning isn't obvious from the name
   * (status/role/type-ish columns). Without this Claude guesses plausible-sounding
   * values (e.g. "overdue") that don't exist, silently matching zero rows.
   */
  columnValues?: Record<string, string[]>;
};

export const ADMIN_CHAT_TABLES: AdminChatTableDef[] = [
  {
    table: "agency_users",
    description: "Agency staff, social workers, and foster carers.",
    columns: ["id", "role", "is_active", "is_archived", "status", "created_at"],
    filterableColumns: ["role", "is_active", "is_archived", "status"],
    dateRangeColumns: ["created_at"],
    columnValues: {
      role: [
        "agency_admin",
        "sw_manager",
        "social_worker",
        "foster_carer",
        "child",
        "biological_parent",
      ],
      status: ["active"],
    },
  },
  {
    table: "carer_households",
    description: "Foster carer households (a home with carers and placed children).",
    columns: ["id", "name", "status", "is_active", "capacity", "max_children", "created_at"],
    filterableColumns: ["status", "is_active"],
    dateRangeColumns: ["created_at"],
    columnValues: { status: ["active", "inactive"] },
  },
  {
    table: "admin_chat_daily_log_assignments_named",
    description:
      "One row per daily log task for a given date, with names already joined in (the raw daily_log_assignments table only has UUIDs — always use this view instead). assigned_to_name is the row's real name — the CHILD's name when assignment_subject is 'child' (a normal daily log), or the PLACED PARENT's name when assignment_subject is 'placed_parent' (a biological parent's own log about that child — child_name still shows which child it concerns). This exactly matches the admin app's own Daily Log Assignments page: always lead an answer with assigned_to_name, not child_name, so it matches what the admin sees there. Use for 'who has/hasn't submitted today's (or last week's, etc.) log' questions — 'hasn't submitted' means status is NOT completed, i.e. pending or in_progress. When listing rows, prefer columns assigned_to_name, child_name, household_name, status — do NOT include assignment_subject as a returned column (it's the internal reason child_name is sometimes redundant with assigned_to_name; those two names already convey that on their own, so showing the raw 'child'/'placed_parent' value adds nothing for the admin).",
    columns: [
      "assigned_to_name",
      "child_name",
      "household_name",
      "status",
      "assigned_date",
      "due_time",
      "completed_at",
      "id",
      "assignment_subject",
    ],
    filterableColumns: ["assigned_date", "status"],
    dateRangeColumns: ["assigned_date"],
    columnValues: { status: ["pending", "in_progress", "completed"] },
    displayLabel: "daily log assignments",
  },
  {
    table: "daily_log_answers",
    description:
      "One row per question/answer inside a submitted daily log (multiselect already exploded). Use for questions about specific answer content, not just submission counts.",
    columns: ["id", "log_date", "section_id", "field_id", "field_label", "answer_type", "answer_text", "answer_numeric"],
    filterableColumns: ["log_date", "field_id", "answer_type"],
    dateRangeColumns: ["log_date"],
    columnValues: {
      answer_type: [
        "text",
        "textarea",
        "select",
        "multiselect",
        "number",
        "time",
        "items",
        "attachments",
      ],
    },
  },
  {
    table: "events",
    description: "Calendar events (appointments, contact visits, meetings, etc.).",
    columns: ["id", "title", "event_type", "start_datetime", "end_datetime", "location", "is_recurring"],
    filterableColumns: ["event_type"],
    dateRangeColumns: ["start_datetime"],
  },
  {
    table: "documents",
    description: "Managed documents, including signature workflow status.",
    columns: ["id", "title", "document_type", "status", "requires_signature", "expiry_date", "created_at"],
    filterableColumns: ["document_type", "status", "requires_signature"],
    dateRangeColumns: ["created_at", "expiry_date"],
    columnValues: { status: ["unassigned", "assigned", "completed"] },
  },
  {
    table: "tickets",
    description: "Support tickets raised within the agency.",
    columns: ["id", "subject", "priority", "status", "ticket_type", "escalated", "created_at", "resolved_at"],
    filterableColumns: ["status", "priority", "ticket_type", "escalated"],
    dateRangeColumns: ["created_at", "resolved_at"],
    columnValues: {
      status: ["open", "in_progress", "resolved", "verified", "closed", "reopened"],
      priority: ["low", "normal", "high"],
    },
  },
  {
    table: "surveys",
    description: "Surveys created for carers, children, or other agency members.",
    columns: ["id", "title", "status", "is_anonymous", "start_date", "end_date", "frequency"],
    filterableColumns: ["status", "frequency"],
    dateRangeColumns: ["start_date", "end_date"],
    columnValues: {
      status: ["draft", "active", "closed", "expired", "archived"],
      frequency: ["once", "weekly", "monthly", "quarterly", "annually"],
    },
  },
  {
    table: "survey_responses",
    description: "Individual responses to a survey.",
    columns: ["id", "survey_id", "status", "is_anonymous", "completion_time_seconds", "started_at", "completed_at", "avg_score_0_10"],
    filterableColumns: ["status", "survey_id"],
    dateRangeColumns: ["started_at", "completed_at"],
    columnValues: { status: ["draft", "completed", "flagged"] },
  },
  {
    table: "expense_claims",
    description:
      "Foster carer expense claims and their approval status. 'Pending approval' means status is 'new'.",
    columns: ["id", "amount", "expense_date", "status", "created_at", "reviewed_at", "paid_at"],
    filterableColumns: ["status", "expense_date"],
    dateRangeColumns: ["expense_date", "created_at"],
    columnValues: { status: ["new", "approved", "declined", "paid"] },
  },
];

export function findTableDef(table: string): AdminChatTableDef | undefined {
  return ADMIN_CHAT_TABLES.find((def) => def.table === table);
}

function formatColumnValues(def: AdminChatTableDef): string {
  const entries = Object.entries(def.columnValues ?? {});
  if (entries.length === 0) return "";
  const lines = entries.map(([column, values]) => `    ${column}: ${values.join(", ")}`);
  return `\n  known values (use EXACTLY these — never guess a value not listed here):\n${lines.join("\n")}`;
}

export function formatCatalogForPrompt(): string {
  return ADMIN_CHAT_TABLES.map(
    (def) =>
      `- ${def.table}: ${def.description}\n  columns: ${def.columns.join(", ")}\n  filterable columns: ${def.filterableColumns.join(", ")}\n  date-range columns: ${def.dateRangeColumns.join(", ") || "none"}${formatColumnValues(def)}`,
  ).join("\n");
}

export const QUERY_TOOL_NAME = "query_agency_data";

export function buildQueryTool() {
  return {
    name: QUERY_TOOL_NAME,
    description: [
      "Run a read-only count or list against ONE allowlisted table of the admin's own agency data, to answer their question.",
      "Only call this when the question clearly matches one of the tables below. If it doesn't, do not call this tool.",
      "For relative date phrases ('today', 'last week', 'this month', etc.), compute the actual YYYY-MM-DD range yourself from the current date given in your instructions and pass it via date_range — never ask the admin for a date.",
      "",
      formatCatalogForPrompt(),
    ].join("\n"),
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["table", "aggregation"],
      properties: {
        table: {
          type: "string",
          enum: ADMIN_CHAT_TABLES.map((def) => def.table),
        },
        aggregation: {
          type: "string",
          enum: ["count", "list"],
          description: "'count' for how-many questions, 'list' for who/which questions.",
        },
        filters: {
          type: "object",
          description:
            "Equality filters, using only that table's filterable columns. Never include agency_id — it is applied automatically.",
          additionalProperties: { type: ["string", "number", "boolean"] },
        },
        date_range: {
          type: "object",
          description:
            "Optional inclusive date range, for relative date phrases (today/last week/this month/etc). column must be one of that table's date-range columns; from/to are YYYY-MM-DD.",
          additionalProperties: false,
          required: ["column", "from", "to"],
          properties: {
            column: { type: "string" },
            from: { type: "string" },
            to: { type: "string" },
          },
        },
        columns: {
          type: "array",
          description: "Only for aggregation 'list'. Which of that table's columns to return (max 6).",
          items: { type: "string" },
          maxItems: 6,
        },
        limit: {
          type: "integer",
          description: "Only for aggregation 'list'. Max rows to return.",
          minimum: 1,
          maximum: 20,
        },
      },
    },
  } as const;
}
