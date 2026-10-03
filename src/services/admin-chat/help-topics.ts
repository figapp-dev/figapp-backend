/**
 * "How do I use this feature" help content for Ask Figgy — separate from
 * the agency-data query path (schema-catalog.ts). Content lives in
 * `admin_chat_help_topics` (plain flat text columns, edited directly in
 * Supabase Studio, no code change needed to update a topic). This file
 * only builds the tool Claude picks a topic from; the content itself is
 * never hardcoded here.
 */

export type HelpTopicSummary = {
  slug: string;
  title: string;
  platform: "mobile" | "web" | "both";
};

export type HelpTopicRow = HelpTopicSummary & {
  body: string;
};

export const HELP_TOPIC_TOOL_NAME = "get_help_topic";

export function formatHelpTopicsForPrompt(topics: HelpTopicSummary[]): string {
  return topics
    .map((t) => `- ${t.slug} (${t.platform}): ${t.title}`)
    .join("\n");
}

/**
 * Pure: builds the tool Claude uses to answer a "how do I..." platform
 * question, from whatever topics are currently active. The `slug` enum is
 * the allowlist — Claude cannot return a slug that isn't a real, active
 * topic, same discipline as the data-query table allowlist.
 */
export function buildHelpTopicTool(topics: HelpTopicSummary[]) {
  return {
    name: HELP_TOPIC_TOOL_NAME,
    description: [
      "Answer a 'how do I use this feature' / platform-usage question using one of the help topics below — NOT a question about the admin's own agency's data (use query_agency_data for that instead).",
      "Only call this when the question clearly matches exactly one topic below. If it doesn't match any, do not call this tool.",
      "Some topics exist as separate 'mobile' and 'web' versions of the same question, because the steps genuinely differ by platform. If both a mobile and a web topic could match and the question doesn't say which, do NOT guess and do NOT call this tool — instead reply with one short, friendly question asking whether they mean the mobile app or the web app, and wait for their reply.",
      "",
      formatHelpTopicsForPrompt(topics),
    ].join("\n"),
    input_schema: {
      type: "object",
      additionalProperties: false,
      required: ["slug"],
      properties: {
        slug: {
          type: "string",
          enum: topics.map((t) => t.slug),
        },
      },
    },
  } as const;
}
