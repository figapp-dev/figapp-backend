import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  countTodayAdminChatQuestions,
  findAgencyUserRoleByUserId,
  insertAdminChatLog,
} from "../../repositories/admin-chat.js";
import { composeAnswerText, pickQuery } from "./claude-client.js";
import { runValidatedQuery } from "./query-validator.js";
import { env } from "../../config/env.js";
import type { AdminChatAnswer, AdminChatRow } from "../../types/admin-chat.js";

const MAX_QUESTION_LENGTH = 300;

function stringifyRow(row: Record<string, unknown>): AdminChatRow {
  const out: AdminChatRow = {};
  for (const [key, value] of Object.entries(row)) {
    out[key] = value === null || value === undefined ? "" : String(value);
  }
  return out;
}

function humanizeTable(table: string): string {
  return table.replace(/_/g, " ");
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
    await insertAdminChatLog(supabase, {
      agency_id: caller.agency_id,
      user_id: userId,
      question,
      matched_table: null,
      matched_aggregation: null,
      answer: pick.declineText,
      error: null,
    });
    return serviceSuccess<AdminChatAnswer>({
      text: pick.declineText,
      stats: [],
      rows: [],
    });
  }

  const validated = await runValidatedQuery(supabase, caller.agency_id, pick.toolCall);

  if (!validated.ok) {
    await insertAdminChatLog(supabase, {
      agency_id: caller.agency_id,
      user_id: userId,
      question,
      matched_table: pick.toolCall.table,
      matched_aggregation: pick.toolCall.aggregation,
      answer: null,
      error: validated.reason,
    });
    return serviceSuccess<AdminChatAnswer>({
      text: "I couldn't safely answer that question. Try rephrasing it.",
      stats: [],
      rows: [],
    });
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
              label: humanizeTable(pick.toolCall.table),
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
    answer: answerText,
    error: null,
  });

  return serviceSuccess(answer);
}
