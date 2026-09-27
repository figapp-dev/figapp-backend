import type { SupabaseClient } from "@supabase/supabase-js";
import { findTableDef, type AdminChatTableDef } from "./schema-catalog.js";
import {
  countAllowlistedRows,
  listAllowlistedRows,
} from "../../repositories/admin-chat.js";
import { toDateOnly } from "../../lib/dates.js";
import type {
  QueryDateRange,
  QueryToolCall,
  QueryToolResult,
} from "../../types/admin-chat.js";

const MAX_LIST_ROWS = 20;
const DEFAULT_LIST_ROWS = 10;

export type ValidatedQueryResult =
  | { ok: true; result: QueryToolResult }
  | { ok: false; reason: string };

/** Pure: rejects any filter key the table's catalog entry doesn't allow. agency_id is never a filterable column, so a model-supplied agency_id is rejected here rather than silently overridden. */
export function checkFilters(
  def: AdminChatTableDef,
  filters: Record<string, string | number | boolean>,
): string | null {
  const invalidKey = Object.keys(filters).find(
    (key) => !def.filterableColumns.includes(key),
  );
  return invalidKey
    ? `Column "${invalidKey}" is not filterable on "${def.table}".`
    : null;
}

/** Pure: rejects a date_range on a column the table doesn't expose for ranging, or malformed dates. */
export function checkDateRange(
  def: AdminChatTableDef,
  dateRange: QueryDateRange | undefined,
): string | null {
  if (!dateRange) return null;
  if (!def.dateRangeColumns.includes(dateRange.column)) {
    return `Column "${dateRange.column}" is not a date-range column on "${def.table}".`;
  }
  const from = toDateOnly(dateRange.from);
  const to = toDateOnly(dateRange.to);
  if (!from || !to) {
    return "date_range.from/to must be YYYY-MM-DD.";
  }
  if (from > to) {
    return "date_range.from must not be after date_range.to.";
  }
  return null;
}

/** Pure: resolves which columns a 'list' query may select, or an error if one isn't exposed. */
export function resolveListColumns(
  def: AdminChatTableDef,
  requested: string[] | undefined,
): { columns: string[] } | { error: string } {
  const columns = requested?.length ? requested : def.columns.slice(0, 6);
  const invalidColumn = columns.find((column) => !def.columns.includes(column));
  if (invalidColumn) {
    return { error: `Column "${invalidColumn}" is not exposed on "${def.table}".` };
  }
  return { columns };
}

/**
 * Enforces the schema catalog allowlist against whatever Claude asked for,
 * then runs the query. agency_id is always taken from the caller's verified
 * context and forced onto the filter set here — never from the model.
 */
export async function runValidatedQuery(
  supabase: SupabaseClient,
  agencyId: string,
  toolCall: QueryToolCall,
): Promise<ValidatedQueryResult> {
  const def = findTableDef(toolCall.table);
  if (!def) {
    return { ok: false, reason: `Table "${toolCall.table}" is not allowed.` };
  }

  const requestedFilters = toolCall.filters ?? {};
  const filterError = checkFilters(def, requestedFilters);
  if (filterError) {
    return { ok: false, reason: filterError };
  }

  const dateRangeError = checkDateRange(def, toolCall.date_range);
  if (dateRangeError) {
    return { ok: false, reason: dateRangeError };
  }

  const filters = { ...requestedFilters, agency_id: agencyId };

  if (toolCall.aggregation === "count") {
    const { count, error } = await countAllowlistedRows(
      supabase,
      toolCall.table,
      filters,
      toolCall.date_range,
    );
    if (error) return { ok: false, reason: error.message };
    return { ok: true, result: { kind: "count", count } };
  }

  const columnsRes = resolveListColumns(def, toolCall.columns);
  if ("error" in columnsRes) {
    return { ok: false, reason: columnsRes.error };
  }

  const limit = Math.min(toolCall.limit ?? DEFAULT_LIST_ROWS, MAX_LIST_ROWS);
  const { data, error } = await listAllowlistedRows(
    supabase,
    toolCall.table,
    columnsRes.columns,
    filters,
    limit,
    toolCall.date_range,
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: { kind: "list", rows: data } };
}
