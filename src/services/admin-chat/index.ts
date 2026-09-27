import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  countTodayAdminChatQuestions,
  findAgencyUserRoleByUserId,
  insertAdminChatLog,
  listTodayAdminChatHistory,
} from "../../repositories/admin-chat.js";
import { composeAnswerText, pickQuery } from "./claude-client.js";
import { runValidatedQuery } from "./query-validator.js";
import { findTableDef } from "./schema-catalog.js";
import { env } from "../../config/env.js";
import type {
  AdminChatAnswer,
  AdminChatHistoryItem,
  AdminChatRow,
} from "../../types/admin-chat.js";

const MAX_QUESTION_LENGTH = 300;

function stringifyRow(row: Record<string, unknown>): AdminChatRow {
  const out: AdminChatRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === null || value === undefined ? "" : String(value);
  }
  return out;
}

function humanizeTable(table: string): string {
  const displayLabel = findTableDef(table)?.displayLabel;
  return displayLabel ?? table.replace(/_/g, " ");
}

function pluralizeWords(value: string): string {
  const words = value.replace(/_/g, " ");
  return words.endsWith("s") ? words : `${words}s`;
}

/** For a count query, prefer a human label from the role filter (e.g. role: "foster_carer" -> "foster carers") over the raw table name. */
function statLabelFor(table: string, filters: Record<string, unknown> | undefined): string {
  const role = filters?.role;
  return typeof role === "string" && role ? pluralizeWords(role) : humanizeTable(table);
}

/** UTC calendar-day boundary. A rate-limit cap, not a safety boundary — exact UK midnight isn't needed. */
function startOfTodayIso(): string {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  return date.toISOString();
}

export async function askAdminChat(
  supabase: SupabaseClient,
  userId: string,
  questionRaw: string,
) {
  const question = questionRaw.trim().slice(0, MAX_QUESTION_LENGTH);
  if (!question) {
    return serviceFailure({ badRequest: true });
  }

  const callerRes = await findAgencyUserRoleByUserId(supabase, userId);
  if (callerRes.error) return serviceFailure({ error: callerRes.error });

  const caller = callerRes.data;
  if (!caller || caller.role !== "agency_admin" || caller.is_active === false) {
    return serviceFailure({ forbidden: true });
  }
  if (!caller.agency_id) {
    return serviceFailure({ badRequest: true });
  }

  if (!env.anthropicApiKey) {
    return serviceFailure({ error: new Error("ANTHROPIC_API_KEY not configured") });
  }

  const usageRes = await countTodayAdminChatQuestions(
    supabase,
    userId,
    startOfTodayIso(),
  );
  if (usageRes.error) return serviceFailure({ error: usageRes.error });
  if (usageRes.count >= env.adminChatDailyLimit) {
    return serviceFailure({ rateLimited: true });
  }

  const pick = await pickQuery(question);

  if (!pick.matched) {
    const answer: AdminChatAnswer = { text: pick.declineText, stats: [], rows: [] };
    await insertAdminChatLog(supabase, {
      agency_id: caller.agency_id,
      user_id: userId,
      question,
      matched_table: null,
      matched_aggregation: null,
      matched_query: null,
      answer: pick.declineText,
      answer_json: answer,
      error: null,
    });
    return serviceSuccess<AdminChatAnswer>(answer);
  }

  const validated = await runValidatedQuery(supabase, caller.agency_id, pick.toolCall);

  if (!validated.ok) {
    const answer: AdminChatAnswer = {
      text: "I couldn't safely answer that question. Try rephrasing it.",
      stats: [],
      rows: [],
    };
    await insertAdminChatLog(supabase, {
      agency_id: caller.agency_id,
      user_id: userId,
      question,
      matched_table: pick.toolCall.table,
      matched_aggregation: pick.toolCall.aggregation,
      matched_query: pick.toolCall,
      answer: null,
      answer_json: answer,
      error: validated.reason,
    });
    return serviceSuccess<AdminChatAnswer>(answer);
  }

  const answerText = await composeAnswerText(
    question,
    pick.toolCall,
    pick.toolUseId,
    validated.result,
  );

  const answer: AdminChatAnswer =
    validated.result.kind === "count"
      ? {
          text: answerText,
          stats: [
            {
              value: String(validated.result.count),
              label: statLabelFor(pick.toolCall.table, pick.toolCall.filters),
            },
          ],
          rows: [],
        }
      : {
          text: answerText,
          stats: [],
          rows: validated.result.rows.map(stringifyRow),
        };

  await insertAdminChatLog(supabase, {
    agency_id: caller.agency_id,
    user_id: userId,
    question,
    matched_table: pick.toolCall.table,
    matched_aggregation: pick.toolCall.aggregation,
    matched_query: {
      ...pick.toolCall,
      resultCount:
        validated.result.kind === "count"
          ? validated.result.count
          : validated.result.rows.length,
    },
    answer: answerText,
    answer_json: answer,
    error: null,
  });

  return serviceSuccess(answer);
}

/** Today's question/answer history for the calling admin, to restore the chat on page reload. */
export async function getAdminChatHistory(supabase: SupabaseClient, userId: string) {
  const callerRes = await findAgencyUserRoleByUserId(supabase, userId);
  if (callerRes.error) return serviceFailure({ error: callerRes.error });

  const caller = callerRes.data;
  if (!caller || caller.role !== "agency_admin" || caller.is_active === false) {
    return serviceFailure({ forbidden: true });
  }

  const historyRes = await listTodayAdminChatHistory(supabase, userId, startOfTodayIso());
  if (historyRes.error) return serviceFailure({ error: historyRes.error });

  const items: AdminChatHistoryItem[] = historyRes.data.map((row) => ({
    id: row.id,
    question: row.question,
    answer:
      (row.answer_json as AdminChatAnswer | null) ??
      ({ text: row.answer ?? "", stats: [], rows: [] } satisfies AdminChatAnswer),
    createdAt: row.created_at,
  }));

  return serviceSuccess(items);
}
