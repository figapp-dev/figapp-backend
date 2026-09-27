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

export type QueryDateRange = {
  column: string;
  from: string;
  to: string;
};

/** The shape Claude fills in via the generic query tool. Never trusted as-is. */
export type QueryToolCall = {
  table: string;
  aggregation: QueryAggregation;
  filters?: Record<string, string | number | boolean>;
  date_range?: QueryDateRange;
  columns?: string[];
  limit?: number;
};

export type QueryToolResult =
  | { kind: "count"; count: number }
  | { kind: "list"; rows: Record<string, unknown>[] };

/** One past question/answer pair, for restoring the chat on page reload. */
export type AdminChatHistoryItem = {
  id: string;
  question: string;
  answer: AdminChatAnswer;
  createdAt: string;
};
