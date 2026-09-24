import { describe, expect, it } from "vitest";
import { dailyLogCatalog } from "../../src/daily-log-catalog/catalog.js";
import { resolveQuestion, resolveSuggestions, resolveVisible } from "../../src/daily-log-catalog/resolve.js";
import type { SubstitutionTokens } from "../../src/daily-log-catalog/types.js";

// Cross-checked against the already-approved Flutter wording, straight
// from figapp-flutter/test/features/daily_logs/question_phrasing_test.dart
// (Section 1 -- Morning routine & meals). If either drifts, this fails.

const tokens: SubstitutionTokens = { they: "Test Eleven", possessive: "Test Eleven's", wasWere: "was" };

describe("catalog: Section 1 -- Morning routine & meals", () => {
  it("matches the approved Flutter wording for the meal toggles", () => {
    expect(resolveQuestion(dailyLogCatalog.fields.waking_time, { answers: {} }, tokens)).toBe(
      "What time did Test Eleven wake up today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.breakfast, { answers: {} }, tokens)).toBe(
      "Did Test Eleven have breakfast this morning?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.lunch, { answers: {} }, tokens)).toBe(
      "Did Test Eleven have lunch today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.dinner, { answers: {} }, tokens)).toBe(
      "Did Test Eleven have dinner today?",
    );
  });

  it("breakfast_details: visible and worded correctly on Yes", () => {
    const scope = { answers: { breakfast: "Yes" } };
    expect(resolveVisible(dailyLogCatalog.fields.breakfast_details, scope)).toBe(true);
    expect(resolveQuestion(dailyLogCatalog.fields.breakfast_details, scope, tokens)).toBe(
      "What did Test Eleven have for breakfast?",
    );
  });

  it("breakfast_details: reworded and suggests skip-reasons on No", () => {
    const scope = { answers: { breakfast: "No" } };
    expect(resolveVisible(dailyLogCatalog.fields.breakfast_details, scope)).toBe(true);
    expect(resolveQuestion(dailyLogCatalog.fields.breakfast_details, scope, tokens)).toBe(
      "Why didn't Test Eleven have breakfast this morning?",
    );
    expect(resolveSuggestions(dailyLogCatalog.fields.breakfast_details, scope, tokens)).toEqual([
      "Wasn't hungry",
      "Refused to eat",
      "Not enough time before school",
      "Feeling unwell",
      "Ate elsewhere",
    ]);
  });

  it("breakfast_details: hidden on Unknown (Rule E)", () => {
    expect(resolveVisible(dailyLogCatalog.fields.breakfast_details, { answers: { breakfast: "Unknown" } })).toBe(
      false,
    );
    expect(resolveVisible(dailyLogCatalog.fields.breakfast_details, { answers: {} })).toBe(false);
  });

  it("snack_details: visible only on Yes, never asks why on No or Unknown (Rule E)", () => {
    expect(resolveVisible(dailyLogCatalog.fields.snack_details, { answers: { snack: "Yes" } })).toBe(true);
    expect(resolveVisible(dailyLogCatalog.fields.snack_details, { answers: { snack: "No" } })).toBe(false);
    expect(resolveVisible(dailyLogCatalog.fields.snack_details, { answers: { snack: "Unknown" } })).toBe(false);
    expect(
      resolveQuestion(dailyLogCatalog.fields.snack_details, { answers: { snack: "Yes" } }, tokens),
    ).toBe("What snacks did Test Eleven have today?");
  });
});

describe("catalog: Section 3 -- Leisure activities & family time", () => {
  const possessiveTokens: SubstitutionTokens = {
    they: "Alex",
    possessive: "Alex's",
    wasWere: "was",
  };

  it("matches the approved Flutter wording, all always visible", () => {
    const scope = { answers: {} };
    for (const fieldId of [
      "leisure_activities",
      "leisure_comments",
      "leisure_attachments",
      "family_time",
      "family_time_comments",
      "family_time_attachments",
    ] as const) {
      expect(resolveVisible(dailyLogCatalog.fields[fieldId], scope)).toBe(true);
    }

    expect(resolveQuestion(dailyLogCatalog.fields.leisure_activities, scope, possessiveTokens)).toBe(
      "What did Alex get up to for fun today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.leisure_comments, scope, possessiveTokens)).toBe(
      "Would you like to add anything about Alex's leisure time?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.leisure_attachments, scope, possessiveTokens)).toBe(
      "Would you like to attach any photos from Alex's activities today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.family_time, scope, possessiveTokens)).toBe(
      "How did Alex spend time with their foster family today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.family_time_comments, scope, possessiveTokens)).toBe(
      "Would you like to add anything about Alex's foster family experience today?",
    );
    expect(resolveQuestion(dailyLogCatalog.fields.family_time_attachments, scope, possessiveTokens)).toBe(
      "Would you like to add any photos from Alex's foster family experience today?",
    );
  });
});

describe("catalog: Section 4 -- Appointments, medications & contact", () => {
  it("group items list is visible only when its own toggle is Yes", () => {
    const appointments = dailyLogCatalog.fields.appointments;
    expect(resolveVisible(appointments, { answers: { has_appointments: "Yes" } })).toBe(true);
    expect(resolveVisible(appointments, { answers: { has_appointments: "No" } })).toBe(false);
    expect(resolveVisible(appointments, { answers: {} })).toBe(false);
  });

  it("appointment comments: named category wins, unnamed type falls to the {type} default", () => {
    const comments = appointments().repeatableFields!.find((f) => f.fieldId === "comments")!;
    const rowScope = (type: string) => ({ answers: { type } });

    expect(resolveSuggestions(comments, rowScope("Dentist"), tokens)).toEqual([
      "Check-up completed; teeth cleaned as planned.",
      "No treatment needed today; next review booked if required.",
      "Oral health advice given; child cooperative throughout.",
    ]);
    // SSW Visit shares CSW Visit's category, matching today's app behavior.
    expect(resolveSuggestions(comments, rowScope("SSW Visit"), tokens)).toEqual([
      "Visit completed; progress and support needs discussed.",
      "No safeguarding concerns raised during the visit.",
      "Actions agreed and shared with the carer.",
    ]);
    // Not a named category -- falls to the {type}-templated default.
    expect(resolveSuggestions(comments, rowScope("Parents Evening"), {
      ...tokens,
      type: "Parents Evening",
    })).toEqual([
      "Parents Evening appointment attended as scheduled.",
      "Child cooperative throughout the Parents Evening appointment.",
      "No concerns raised during the Parents Evening appointment.",
    ]);
  });

  it("contacts who_with: Phone Call branches on the supervised flag, in priority order", () => {
    const whoWith = contacts().repeatableFields!.find((f) => f.fieldId === "who_with")!;
    expect(
      resolveSuggestions(whoWith, { answers: { mode: "Phone Call", contact_type: "Supervised" } }, tokens),
    ).toEqual(["Mother", "Father", "Both parents"]);
    expect(
      resolveSuggestions(whoWith, { answers: { mode: "Phone Call", contact_type: "Unsupervised" } }, tokens),
    ).toEqual(["Mother", "Father", "Sibling"]);
    expect(resolveSuggestions(whoWith, { answers: { mode: "Letterbox" } }, tokens)).toEqual([
      "Mother",
      "Father",
      "Maternal grandmother",
    ]);
  });

  it("contacts comments: mode + supervised flag select the right phrase set, {who} left for the caller", () => {
    const comments = contacts().repeatableFields!.find((f) => f.fieldId === "comments")!;
    const withWho = { ...tokens, who: "Mother" };
    expect(
      resolveSuggestions(
        comments,
        { answers: { mode: "Face to Face", contact_type: "Supervised" } },
        withWho,
      ),
    ).toEqual([
      "Supervised face-to-face contact with Mother went as planned.",
      "Child engaged positively during the contact.",
      "No concerns raised; next contact as arranged.",
    ]);
    // Unsupervised face-to-face isn't a named variant -- falls to default.
    expect(
      resolveSuggestions(
        comments,
        { answers: { mode: "Face to Face", contact_type: "Unsupervised" } },
        withWho,
      ),
    ).toEqual([
      "Face-to-face contact with Mother went well.",
      "Child engaged positively during the contact.",
      "No concerns raised; next contact as arranged.",
    ]);
  });
});

function appointments() {
  return dailyLogCatalog.fields.appointments;
}
function contacts() {
  return dailyLogCatalog.fields.contacts;
}

describe("catalog: Section 5 -- Evening, household tasks & mood", () => {
  it("return-home follow-ups are visible only for their own exact status", () => {
    const late = dailyLogCatalog.fields.return_home_late_details;
    const notReturn = dailyLogCatalog.fields.return_home_not_return_details;

    expect(resolveVisible(late, { answers: { return_home_status: "Returned late" } })).toBe(true);
    expect(resolveVisible(late, { answers: { return_home_status: "Did not return" } })).toBe(false);
    expect(resolveVisible(late, { answers: { return_home_status: "Returned by acceptable time" } })).toBe(
      false,
    );

    expect(resolveVisible(notReturn, { answers: { return_home_status: "Did not return" } })).toBe(true);
    expect(resolveVisible(notReturn, { answers: { return_home_status: "Returned late" } })).toBe(false);
    expect(resolveQuestion(notReturn, { answers: {} }, tokens)).toBe("Why didn't Test Eleven return home?");
  });

  it("mood_comments is visible once any mood is selected, not just 'Other'", () => {
    const moodComments = dailyLogCatalog.fields.mood_comments;
    expect(resolveVisible(moodComments, { answers: { mood_of_the_day: ["Happy (Cheerful, positive, content)"] } })).toBe(
      true,
    );
    expect(resolveVisible(moodComments, { answers: { mood_of_the_day: [] } })).toBe(false);
    expect(resolveVisible(moodComments, { answers: {} })).toBe(false);
  });

  it("household and allowance follow-ups are gated on their own toggle", () => {
    const fieldsGatedByHousehold = ["household_tasks_performed", "household_task_comments"] as const;
    for (const fieldId of fieldsGatedByHousehold) {
      expect(resolveVisible(dailyLogCatalog.fields[fieldId], { answers: { household_tasks: "Yes" } })).toBe(true);
      expect(resolveVisible(dailyLogCatalog.fields[fieldId], { answers: { household_tasks: "No" } })).toBe(false);
    }

    const fieldsGatedByAllowance = ["allowance_amount", "payment_mode", "allowances_details"] as const;
    for (const fieldId of fieldsGatedByAllowance) {
      expect(resolveVisible(dailyLogCatalog.fields[fieldId], { answers: { allowances_given: "Yes" } })).toBe(
        true,
      );
      expect(resolveVisible(dailyLogCatalog.fields[fieldId], { answers: { allowances_given: "No" } })).toBe(
        false,
      );
    }
  });
});

describe("catalog: Section 6 -- Incidents & final comments", () => {
  it("incident_items (documented exception) is visible only when the incidents toggle is Yes", () => {
    const items = dailyLogCatalog.fields.incident_items;
    expect(resolveVisible(items, { answers: { incidents: "Yes" } })).toBe(true);
    expect(resolveVisible(items, { answers: { incidents: "No" } })).toBe(false);
    expect(resolveVisible(items, { answers: {} })).toBe(false);
  });

  it("incidents toggle and other_comments are always visible", () => {
    expect(resolveVisible(dailyLogCatalog.fields.incidents, { answers: {} })).toBe(true);
    expect(resolveVisible(dailyLogCatalog.fields.other_comments, { answers: {} })).toBe(true);
    expect(resolveQuestion(dailyLogCatalog.fields.other_comments, { answers: {} }, tokens)).toBe(
      "Anything else you'd like to add about Test Eleven's day?",
    );
  });

  it("incident row sub-questions match the widget's exact wording", () => {
    const fields = dailyLogCatalog.fields.incident_items.repeatableFields!;
    const byId = Object.fromEntries(fields.map((f) => [f.fieldId, f]));
    expect(resolveQuestion(byId.type, { answers: {} }, tokens)).toBe("What type of incident was it?");
    expect(resolveQuestion(byId.time, { answers: {} }, tokens)).toBe("What time did the incident occur?");
    expect(resolveQuestion(byId.status, { answers: {} }, tokens)).toBe(
      "Have you already reported this incident through the Agency's incident reporting process?",
    );
  });
});
