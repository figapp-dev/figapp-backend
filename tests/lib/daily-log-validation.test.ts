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

  it("does not require allowance amount when pocket money was No", () => {
    const evening = [
      {
        id: "evening",
        title: "Evening, household tasks & mood",
        fields: [
          { id: "allowances_given", required: true },
          { id: "allowance_amount", required: true },
        ],
      },
    ];
    expect(
      validateDailyLogSubmit({ allowances_given: "No" }, evening),
    ).toEqual({ ok: true });
  });

  it("requires allowance amount when pocket money was Yes", () => {
    const evening = [
      {
        id: "evening",
        fields: [
          { id: "allowances_given", required: true },
          { id: "allowance_amount", required: true },
        ],
      },
    ];
    const result = validateDailyLogSubmit({ allowances_given: "Yes" }, evening);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["allowance_amount"]);
    }
  });

  const school = [
    {
      id: "school",
      title: "School / Education",
      fields: [
        {
          id: "attended_school",
          label: "Did the child attend school today?",
          required: true,
        },
        {
          id: "attended_on_time",
          label: "Did the child arrive at school on time?",
          required: true,
        },
      ],
    },
  ];

  it("does not require 'arrived on time' when the child did not attend school", () => {
    expect(
      validateDailyLogSubmit({ attended_school: "No" }, school),
    ).toEqual({ ok: true });
  });

  it("requires 'arrived on time' once the child attended school", () => {
    const result = validateDailyLogSubmit(
      { attended_school: "Yes" },
      school,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["attended_on_time"]);
    }
  });

  // Regression: real production templates mark every one of these
  // conditional follow-ups `required: false` (confirmed via a live query),
  // so isFieldRequired(field) alone let submit accept the log with them
  // empty — even though the chat/form UI (web + Flutter) already blocked
  // submitting from the client with them empty. These fields must become
  // required from the sibling answer alone, matching the template shape
  // production actually uses (required: false throughout).
  describe("code-level-required follow-ups (template does not mark them required)", () => {
    const evening = [
      {
        id: "evening",
        title: "Evening, household tasks & mood",
        fields: [
          { id: "return_home_status", required: false },
          { id: "return_home_late_details", required: false },
          { id: "return_home_not_return_details", required: false },
          { id: "allowances_given", required: false },
          { id: "allowance_amount", required: false },
          { id: "payment_mode", required: false },
          { id: "allowance_comments", required: false },
          { id: "allowances_details", required: false },
        ],
      },
    ];

    it("requires 'no return details' once return_home_status is 'Did not return'", () => {
      const result = validateDailyLogSubmit(
        { return_home_status: "Did not return" },
        evening,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missingFieldIds).toEqual([
          "return_home_not_return_details",
        ]);
      }
    });

    it("requires 'return home late details' once return_home_status is late", () => {
      const result = validateDailyLogSubmit(
        { return_home_status: "Returned late" },
        evening,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.missingFieldIds).toEqual(["return_home_late_details"]);
      }
    });

    it("does not require return-home follow-ups when the child returned on time", () => {
      expect(
        validateDailyLogSubmit(
          { return_home_status: "Returned by acceptable time" },
          evening,
        ),
      ).toEqual({ ok: true });
    });

    it("requires every visible allowance follow-up once allowances_given is Yes, even though none are template-required", () => {
      const result = validateDailyLogSubmit(
        { allowances_given: "Yes" },
        evening,
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(new Set(result.missingFieldIds)).toEqual(
          new Set([
            "allowance_amount",
            "payment_mode",
            "allowance_comments",
            "allowances_details",
          ]),
        );
      }
    });

    it("does not require allowance follow-ups when allowances_given is No", () => {
      expect(
        validateDailyLogSubmit({ allowances_given: "No" }, evening),
      ).toEqual({ ok: true });
    });
  });

  it("requires reason for absence once attended=No even when the template does not mark it required", () => {
    const schoolNotRequired = [
      {
        id: "school",
        title: "School / Education",
        fields: [
          { id: "attended_school", label: "Attended school", required: false },
          { id: "reason_for_absence", label: "Reason for absence", required: false },
        ],
      },
    ];
    const result = validateDailyLogSubmit(
      { attended_school: "No" },
      schoolNotRequired,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["reason_for_absence"]);
    }
  });

  it("requires reason for lateness once attended=Yes and on-time=No, template-required or not", () => {
    const schoolNotRequired = [
      {
        id: "school",
        title: "School / Education",
        fields: [
          { id: "attended_school", label: "Attended school", required: false },
          { id: "attended_on_time", label: "Attended on time", required: false },
          { id: "reason_for_lateness", label: "Reason for lateness", required: false },
        ],
      },
    ];
    const result = validateDailyLogSubmit(
      { attended_school: "Yes", attended_on_time: "No" },
      schoolNotRequired,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.missingFieldIds).toEqual(["reason_for_lateness"]);
    }
  });
});
