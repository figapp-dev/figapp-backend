import { env } from "../../config/env.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import {
  buildQueryTool,
  formatCatalogForPrompt,
  QUERY_TOOL_NAME,
} from "./schema-catalog.js";
import {
  buildHelpTopicTool,
  formatHelpTopicsForPrompt,
  HELP_TOPIC_TOOL_NAME,
  type HelpTopicSummary,
} from "./help-topics.js";
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

function findToolUse(
  blocks: AnthropicContentBlock[],
  name?: string,
): { type: "tool_use"; id: string; name: string; input: unknown } | undefined {
  return blocks.find(
    (block): block is { type: "tool_use"; id: string; name: string; input: unknown } =>
      block.type === "tool_use" && (name === undefined || block.name === name),
  );
}

/** A prior question + the plain-text answer Figgy gave for it, oldest first. */
export type ChatHistoryTurn = { question: string; answerText: string };

/** Alternating user/assistant messages for each prior turn, so a follow-up
 * like "what about just the active ones?" resolves against what was asked
 * (and answered) right before it, instead of being read in isolation. */
function historyMessages(
  history: ChatHistoryTurn[],
): Array<{ role: "user" | "assistant"; content: string }> {
  return history.flatMap((turn) => [
    { role: "user" as const, content: turn.question },
    { role: "assistant" as const, content: turn.answerText },
  ]);
}

function buildPickSystemPrompt(helpTopics: HelpTopicSummary[]): string {
  return [
    "You are Ask Figgy, a chat assistant for agency admins on FigApp, a UK foster care agency management platform.",
    `Today's date (Europe/London) is ${getTodayUKDateString()}. Resolve "today"/"this week"/"this month" etc. against this date yourself — never ask the admin what today's date is.`,
    `Admins ask two kinds of questions: operational questions about their own agency's data (call ${QUERY_TOOL_NAME} for these) and "how do I use this feature" platform questions (call ${HELP_TOPIC_TOOL_NAME} for these, when a topic is available — see its own tool description for the mobile/web clarifying-question rule).`,
    helpTopics.length === 0
      ? ""
      : "Never call both tools for one question — a question is either about the agency's data or about how to use the platform, not both, unless it explicitly asks two separate things.",
    "If the question does not clearly match either tool, do NOT call a tool — reply with one short, friendly sentence saying you can't answer that yet, and suggest they check elsewhere in FigApp or contact support if it seems important. This includes the mobile/web clarifying question described above.",
    "Any reply you write without calling a tool (a decline, or a mobile/web clarifying question) must be plain text — no markdown, no bold, no asterisks.",
    "You are talking to a non-technical agency admin, never a developer. Never mention tables, columns, fields, filters, queries, schemas, topics, or any other implementation detail, and never name a tool. Speak only in plain, everyday terms about carers, children, households, logs, documents, etc.",
    "Never invent numbers or steps.",
  ]
    .filter(Boolean)
    .join(" ");
}

export type PickResult =
  | { matched: true; kind: "data"; toolCall: QueryToolCall; toolUseId: string }
  | { matched: true; kind: "help"; slug: string; toolUseId: string }
  | { matched: false; declineText: string };

/**
 * Call 1 — this is where the user's question actually gets "analyzed": the
 * model reads the question (plus recent prior turns, for follow-ups like
 * "what about just the active ones?" or a mobile/web clarifying reply)
 * against the schema catalog AND the active help topics, and decides which
 * one (if any) answers it. Our code never parses the question itself; it
 * only validates and executes whatever the model decided.
 */
export async function pickQuery(
  question: string,
  history: ChatHistoryTurn[] = [],
  helpTopics: HelpTopicSummary[] = [],
): Promise<PickResult> {
  const tools =
    helpTopics.length === 0
      ? [buildQueryTool()]
      : [buildQueryTool(), buildHelpTopicTool(helpTopics)];

  const { content } = await callAnthropic({
    model: env.adminChatModel,
    max_tokens: 512,
    system: buildPickSystemPrompt(helpTopics),
    tools,
    tool_choice: { type: "auto" },
    messages: [...historyMessages(history), { role: "user", content: question }],
  });

  const toolUse = findToolUse(content);

  if (toolUse?.name === QUERY_TOOL_NAME) {
    return {
      matched: true,
      kind: "data",
      toolCall: toolUse.input as QueryToolCall,
      toolUseId: toolUse.id,
    };
  }

  if (toolUse?.name === HELP_TOPIC_TOOL_NAME) {
    const input = toolUse.input as { slug?: unknown };
    return {
      matched: true,
      kind: "help",
      slug: String(input.slug ?? ""),
      toolUseId: toolUse.id,
    };
  }

  const declineText = textOf(content);
  return { matched: false, declineText: declineText || "I can't answer that yet." };
}

/** Forces the compose step's output through one structured tool call instead
 * of plain text, so the answer and its follow-up suggestions come back from
 * ONE API call rather than a separate round-trip per piece. */
const ANSWER_TOOL_NAME = "provide_answer";

function buildAnswerTool() {
  return {
    name: ANSWER_TOOL_NAME,
    description: "Provide your final answer and 0-3 suggested follow-up questions.",
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["answer"],
      properties: {
        answer: {
          type: "string",
          description:
            "The final answer text, following every formatting rule given in your system prompt exactly.",
        },
        suggested_questions: {
          type: "array",
          items: { type: "string" },
          maxItems: 3,
          description:
            "0-3 short, different follow-up questions the admin could naturally ask next, each one clearly answerable from the 'Other things the admin could ask about' list in your system prompt. Phrase each as a complete question in plain English, exactly as the admin would type it themselves. Never repeat the question just asked. Leave empty if nothing sensible to suggest — never invent a question you couldn't actually answer.",
        },
      },
    },
  } as const;
}

/** Appended to both compose system prompts so a composed answer can suggest
 * a sensible next question from the SAME catalogs pickQuery already uses —
 * never an invented one. */
function suggestionsContext(helpTopics: HelpTopicSummary[]): string {
  const helpText = formatHelpTopicsForPrompt(helpTopics);
  return [
    "",
    "Other things the admin could ask about, for your suggested_questions only — never use this list to answer the current question, only to suggest what else they could ask next:",
    formatCatalogForPrompt(),
    helpText,
  ]
    .filter(Boolean)
    .join("\n");
}

export type ComposeResult = { text: string; suggestedQuestions: string[] };

function parseAnswerTool(content: AnthropicContentBlock[]): ComposeResult {
  const toolUse = findToolUse(content, ANSWER_TOOL_NAME);
  if (!toolUse) {
    return { text: textOf(content) || "Here's what I found.", suggestedQuestions: [] };
  }

  const input = toolUse.input as { answer?: unknown; suggested_questions?: unknown };
  const text =
    typeof input.answer === "string" && input.answer.trim()
      ? input.answer
      : "Here's what I found.";
  const suggestedQuestions = Array.isArray(input.suggested_questions)
    ? input.suggested_questions
        .filter((q): q is string => typeof q === "string" && q.trim().length > 0)
        .slice(0, 3)
    : [];

  return { text, suggestedQuestions };
}

const COMPOSE_SYSTEM_PROMPT = [
  "You just ran a read-only query against the agency's own data on the admin's behalf.",
  "Write ONE short, plain sentence answering their question using ONLY the numbers/rows in the tool result below.",
  "Never invent or round numbers. UK English. No markdown, no bullet points.",
  "If the result is a count of 0 or an empty rows list, say plainly that nothing matched (e.g. \"No records matched that.\") — never phrase a zero/empty result as a reassuring positive claim (e.g. never say \"everyone has done X\" just because zero rows matched a filter for \"hasn't done X\"; the filter itself may be wrong).",
  "You are talking to a non-technical agency admin, never a developer. Never mention tables, columns, fields, filters, queries, schemas, or any other implementation detail. Speak only in plain, everyday terms.",
].join(" ");

/** Call 2 — turns the validated query result into the natural-language sentence shown to the admin, plus 0-3 suggested follow-up questions. */
export async function composeAnswerText(
  question: string,
  toolCall: QueryToolCall,
  toolUseId: string,
  toolResult: QueryToolResult,
  history: ChatHistoryTurn[] = [],
  helpTopics: HelpTopicSummary[] = [],
): Promise<ComposeResult> {
  const toolResultText = JSON.stringify(
    toolResult.kind === "count"
      ? { count: toolResult.count }
      : { rows: toolResult.rows },
  );

  const { content } = await callAnthropic({
    model: env.adminChatModel,
    max_tokens: 400,
    system: COMPOSE_SYSTEM_PROMPT + suggestionsContext(helpTopics),
    tools: [buildQueryTool(), buildAnswerTool()],
    tool_choice: { type: "tool", name: ANSWER_TOOL_NAME },
    messages: [
      ...historyMessages(history),
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

  return parseAnswerTool(content);
}

const HELP_COMPOSE_SYSTEM_PROMPT = [
  "You are answering a 'how do I use this feature' question using the official help content below, found for the admin.",
  "Use ONLY the content provided — never invent or add a step that isn't there, and never add numbering that isn't already there.",
  "If the content below is already written as numbered steps (starts with \"1.\", \"2.\", etc.), your answer MUST keep that exact numbered, one-step-per-line structure — each step on its own line, separated by a real line break (\\n). You may lightly reword a step's wording to fit the specific question asked, but never merge steps into one paragraph and never drop the numbering.",
  "If the content is NOT already numbered (a single fact or a short explanation), write your answer as plain sentences — do not invent step numbering that isn't present in the content.",
  "You are talking to a non-technical agency admin, never a developer. Plain, everyday language, UK English.",
  "No markdown syntax at all — no **bold**, no *italics*, no bullet dashes/asterisks, no # headings. Plain text and real line breaks only; this is shown in a plain-text chat bubble that does not render markdown.",
].join(" ");

/** Call 2 for the help-topic path — turns a stored topic's body text into the reply shown to the admin, plus 0-3 suggested follow-up questions. */
export async function composeHelpAnswerText(
  question: string,
  slug: string,
  toolUseId: string,
  topicBody: string,
  history: ChatHistoryTurn[] = [],
  helpTopics: HelpTopicSummary[] = [],
): Promise<ComposeResult> {
  const { content } = await callAnthropic({
    model: env.adminChatModel,
    max_tokens: 500,
    system: HELP_COMPOSE_SYSTEM_PROMPT + suggestionsContext(helpTopics),
    tools: [buildAnswerTool()],
    tool_choice: { type: "tool", name: ANSWER_TOOL_NAME },
    messages: [
      ...historyMessages(history),
      { role: "user", content: question },
      {
        role: "assistant",
        content: [
          { type: "tool_use", id: toolUseId, name: HELP_TOPIC_TOOL_NAME, input: { slug } },
        ],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: toolUseId, content: topicBody },
        ],
      },
    ],
  });

  return parseAnswerTool(content);
}
