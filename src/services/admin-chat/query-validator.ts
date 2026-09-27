import type { SupabaseClient } from "@supabase/supabase-js";
import { findTableDef, type AdminChatTableDef } from "./schema-catalog.js";
import {
  countAllowlistedRows,
  listAllowlistedRows,
} from "../../repositories/admin-chat.js";
import type { QueryToolCall, QueryToolResult } from "../../types/admin-chat.js";

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

  const filters = { ...requestedFilters, agency_id: agencyId };

  if (toolCall.aggregation === "count") {
    const { count, error } = await countAllowlistedRows(
      supabase,
      toolCall.table,
      filters,
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
  );
  if (error) return { ok: false, reason: error.message };
  return { ok: true, result: { kind: "list", rows: data } };
}
