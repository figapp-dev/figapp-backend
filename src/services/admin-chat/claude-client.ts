import { env } from "../../config/env.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import { buildQueryTool, QUERY_TOOL_NAME } from "./schema-catalog.js";
import type { QueryToolCall, QueryToolResult } from "../../types/admin-chat.js";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

type AnthropicContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: unknown };

async function callAnthropic(body: Record<string, unknown>): Promise<{
  content: AnthropicContentBlock[];
}> {
  if (!env.anthropicApiKey) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": env.anthropicApiKey,
      "anthropic-version": ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errText}`);
  }

  const json = await response.json();
  return { content: Array.isArray(json?.content) ? json.content : [] };
}

function textOf(blocks: AnthropicContentBlock[]): string {
  return blocks
    .filter((block): block is { type: "text"; text: string } => block.type === "text")
    .map((block) => block.text)
    .join(" ")
    .trim();
}

function buildPickSystemPrompt(): string {
  return [
    "You are Ask Figgy, a chat assistant for agency admins on FigApp, a UK foster care agency management platform.",
    `Today's date (Europe/London) is ${getTodayUKDateString()}. Resolve "today"/"this week"/"this month" etc. against this date yourself — never ask the admin what today's date is.`,
    `Admins ask short operational questions about their own agency's data. Call the ${QUERY_TOOL_NAME} tool when the question clearly matches one of its allowed tables.`,
    "If the question does not clearly match, do NOT call the tool — reply with one short, friendly sentence saying you can't answer that yet, and suggest they check elsewhere in FigApp or contact support if it seems important.",
    "You are talking to a non-technical agency admin, never a developer. Never mention tables, columns, fields, filters, queries, schemas, or any other implementation detail, and never name the query tool. Speak only in plain, everyday terms about carers, children, households, logs, documents, etc.",
    "Never invent numbers.",
  ].join(" ");
}

export type PickResult =
  | { matched: true; toolCall: QueryToolCall; toolUseId: string }
  | { matched: false; declineText: string };

/**
 * Call 1 — this is where the user's question actually gets "analyzed": the
 * model reads the question against the schema catalog and decides which
 * table/aggregation (if any) answers it. Our code never parses the question
 * itself; it only validates and executes whatever the model decided.
 */
export async function pickQuery(question: string): Promise<PickResult> {
  const { content } = await callAnthropic({
    model: env.adminChatModel,
    max_tokens: 512,
    system: buildPickSystemPrompt(),
    tools: [buildQueryTool()],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: question }],
  });

  const toolUse = content.find(
    (block): block is { type: "tool_use"; id: string; name: string; input: unknown } =>
      block.type === "tool_use" && block.name === QUERY_TOOL_NAME,
  );

  if (toolUse) {
    return {
      matched: true,
      toolCall: toolUse.input as QueryToolCall,
      toolUseId: toolUse.id,
    };
  }

  const declineText = textOf(content);
  return { matched: false, declineText: declineText || "I can't answer that yet." };
}

const COMPOSE_SYSTEM_PROMPT = [
  "You just ran a read-only query against the agency's own data on the admin's behalf.",
  "Write ONE short, plain sentence answering their question using ONLY the numbers/rows in the tool result below.",
  "Never invent or round numbers. UK English. No markdown, no bullet points.",
  "If the result is a count of 0 or an empty rows list, say plainly that nothing matched (e.g. \"No records matched that.\") — never phrase a zero/empty result as a reassuring positive claim (e.g. never say \"everyone has done X\" just because zero rows matched a filter for \"hasn't done X\"; the filter itself may be wrong).",
  "You are talking to a non-technical agency admin, never a developer. Never mention tables, columns, fields, filters, queries, schemas, or any other implementation detail. Speak only in plain, everyday terms.",
].join(" ");

/** Call 2 — turns the validated query result into the natural-language sentence shown to the admin. */
export async function composeAnswerText(
  question: string,
  toolCall: QueryToolCall,
  toolUseId: string,
  toolResult: QueryToolResult,
): Promise<string> {
  const toolResultText = JSON.stringify(
    toolResult.kind === "count"
      ? { count: toolResult.count }
      : { rows: toolResult.rows },
  );

  const { content } = await callAnthropic({
    model: env.adminChatModel,
    max_tokens: 300,
    system: COMPOSE_SYSTEM_PROMPT,
    tools: [buildQueryTool()],
    messages: [
      { role: "user", content: question },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: toolUseId, name: QUERY_TOOL_NAME, input: toolCall },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUseId, content: toolResultText },
        ],
      },
    ],
  });

  return textOf(content) || "Here's what I found.";
}
