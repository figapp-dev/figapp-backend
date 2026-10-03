import { describe, expect, it } from "vitest";
import {
  buildHelpTopicTool,
  formatHelpTopicsForPrompt,
  HELP_TOPIC_TOOL_NAME,
  type HelpTopicSummary,
} from "../../../src/services/admin-chat/help-topics.js";

const topics: HelpTopicSummary[] = [
  { slug: "daily-log-submit-mobile", title: "How to submit a daily log (mobile app)", platform: "mobile" },
  { slug: "daily-log-submit-web", title: "How to submit a daily log (web)", platform: "web" },
  { slug: "daily-log-autosave", title: "Can a daily log be saved and finished later?", platform: "both" },
];

describe("formatHelpTopicsForPrompt", () => {
  it("lists every topic with its slug, platform, and title", () => {
    const text = formatHelpTopicsForPrompt(topics);
    expect(text).toContain("daily-log-submit-mobile (mobile): How to submit a daily log (mobile app)");
    expect(text).toContain("daily-log-submit-web (web): How to submit a daily log (web)");
    expect(text).toContain("daily-log-autosave (both): Can a daily log be saved and finished later?");
  });

  it("returns an empty string for no topics", () => {
    expect(formatHelpTopicsForPrompt([])).toBe("");
  });
});

describe("buildHelpTopicTool", () => {
  it("names the tool consistently with the exported constant", () => {
    expect(buildHelpTopicTool(topics).name).toBe(HELP_TOPIC_TOOL_NAME);
  });

  it("restricts the slug enum to exactly the given topics (the allowlist)", () => {
    const tool = buildHelpTopicTool(topics);
    expect(tool.input_schema.properties.slug.enum).toEqual([
      "daily-log-submit-mobile",
      "daily-log-submit-web",
      "daily-log-autosave",
    ]);
  });

  it("requires slug and forbids extra properties", () => {
    const tool = buildHelpTopicTool(topics);
    expect(tool.input_schema.required).toEqual(["slug"]);
    expect(tool.input_schema.additionalProperties).toBe(false);
  });

  it("includes the mobile/web clarifying-question instruction in the description", () => {
    const tool = buildHelpTopicTool(topics);
    expect(tool.description).toContain("mobile app or the web app");
  });
});
