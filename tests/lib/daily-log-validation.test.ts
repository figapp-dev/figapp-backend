import { describe, expect, it } from "vitest";
import { validateDailyLogSubmit } from "../../src/lib/daily-log-validation.js";

const template = [
  {
    id: "page_am",
    fields: [
      { id: "mood", required: true },
      { id: "notes", required: false },
      {
        id: "has_appts",
        required: true,
        meta: { group: "appointments", role: "toggle" },
      },
      {
        id: "appt_items",
        required: false,
        meta: { group: "appointments", role: "items" },
      },
    ],
  },
];

describe("validateDailyLogSubmit", () => {
  it("flags missing required fields", () => {
    const result = validateDailyLogSubmit({}, template);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["mood", "has_appts"]);
    }
  });

  it("allows partial answers when items toggle is No", () => {
    const result = validateDailyLogSubmit(
      { mood: "Happy", has_appts: "No" },
      template,
    );
    expect(result).toEqual({ ok: true });
  });

  it("requires items when toggle is Yes", () => {
    const result = validateDailyLogSubmit(
      { mood: "Happy", has_appts: "Yes" },
      template,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["appt_items"]);
    }
  });

  it("treats N/A as a filled value", () => {
    const result = validateDailyLogSubmit(
      { mood: "N/A", has_appts: "No" },
      template,
    );
    expect(result).toEqual({ ok: true });
  });

  it("passes when no template fields exist", () => {
    expect(validateDailyLogSubmit({}, [])).toEqual({ ok: true });
  });
});
