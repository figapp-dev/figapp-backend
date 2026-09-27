export type AskAdminChatBody = {
  question: string;
};

export type AgencyAdminCaller = {
  userId: string;
  agencyId: string;
};

/** One card in a stat-card answer, matching the approved chat mockup. */
export type AdminChatStat = {
  value: string;
  label: string;
  delta?: string;
};

/** One row in a table-shaped answer, matching the approved chat mockup. */
export type AdminChatRow = Record<string, string>;

export type AdminChatAnswer = {
  text: string;
  stats: AdminChatStat[];
  rows: AdminChatRow[];
};

export type QueryAggregation = "count" | "list";

/** The shape Claude fills in via the generic query tool. Never trusted as-is. */
export type QueryToolCall = {
  table: string;
  aggregation: QueryAggregation;
  filters?: Record<string, string | number | boolean>;
  columns?: string[];
  limit?: number;
};

export type QueryToolResult =
  | { kind: "count"; count: number }
  | { kind: "list"; rows: Record<string, unknown>[] };
