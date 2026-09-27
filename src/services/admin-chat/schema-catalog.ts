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
};

export const ADMIN_CHAT_TABLES: AdminChatTableDef[] = [
  {
    table: "agency_users",
    description:
      "Agency staff, social workers, and foster carers. role is one of: agency_admin, social_worker, foster_carer.",
    columns: ["id", "role", "is_active", "is_archived", "status", "created_at"],
    filterableColumns: ["role", "is_active", "is_archived", "status"],
  },
  {
    table: "carer_households",
    description: "Foster carer households (a home with carers and placed children).",
    columns: ["id", "name", "status", "is_active", "capacity", "max_children", "created_at"],
    filterableColumns: ["status", "is_active"],
  },
  {
    table: "daily_log_assignments",
    description:
      "One row per daily log a carer/contributor is expected to submit for a child on a given date. Use for 'who has/hasn't submitted today's log' questions.",
    columns: ["id", "assigned_date", "status", "due_time", "completed_at", "child_id", "household_id"],
    filterableColumns: ["assigned_date", "status"],
  },
  {
    table: "daily_log_answers",
    description:
      "One row per question/answer inside a submitted daily log (multiselect already exploded). Use for questions about specific answer content, not just submission counts.",
    columns: ["id", "log_date", "section_id", "field_id", "field_label", "answer_type", "answer_text", "answer_numeric"],
    filterableColumns: ["log_date", "field_id", "answer_type"],
  },
  {
    table: "events",
    description: "Calendar events (appointments, contact visits, meetings, etc.).",
    columns: ["id", "title", "event_type", "start_datetime", "end_datetime", "location", "is_recurring"],
    filterableColumns: ["event_type"],
  },
  {
    table: "documents",
    description: "Managed documents, including signature workflow status.",
    columns: ["id", "title", "document_type", "status", "requires_signature", "expiry_date", "created_at"],
    filterableColumns: ["document_type", "status", "requires_signature"],
  },
  {
    table: "tickets",
    description: "Support tickets raised within the agency.",
    columns: ["id", "subject", "priority", "status", "ticket_type", "escalated", "created_at", "resolved_at"],
    filterableColumns: ["status", "priority", "ticket_type", "escalated"],
  },
  {
    table: "surveys",
    description: "Surveys created for carers, children, or other agency members.",
    columns: ["id", "title", "status", "is_anonymous", "start_date", "end_date", "frequency"],
    filterableColumns: ["status", "frequency"],
  },
  {
    table: "survey_responses",
    description: "Individual responses to a survey.",
    columns: ["id", "survey_id", "status", "is_anonymous", "completion_time_seconds", "started_at", "completed_at", "avg_score_0_10"],
    filterableColumns: ["status", "survey_id"],
  },
  {
    table: "expense_claims",
    description: "Foster carer expense claims and their approval status.",
    columns: ["id", "amount", "expense_date", "status", "created_at", "reviewed_at", "paid_at"],
    filterableColumns: ["status", "expense_date"],
  },
];

export function findTableDef(table: string): AdminChatTableDef | undefined {
  return ADMIN_CHAT_TABLES.find((def) => def.table === table);
}

export function formatCatalogForPrompt(): string {
  return ADMIN_CHAT_TABLES.map(
    (def) =>
      `- ${def.table}: ${def.description}\n  columns: ${def.columns.join(", ")}\n  filterable columns: ${def.filterableColumns.join(", ")}`,
  ).join("\n");
}

export const QUERY_TOOL_NAME = "query_agency_data";

export function buildQueryTool() {
  return {
    name: QUERY_TOOL_NAME,
    description: [
      "Run a read-only count or list against ONE allowlisted table of the admin's own agency data, to answer their question.",
      "Only call this when the question clearly matches one of the tables below. If it doesn't, do not call this tool.",
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
