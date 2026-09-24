import { describe, expect, it } from "vitest";
import { resolveQuestion, resolveVisible } from "../../src/daily-log-catalog/resolve.js";
import { dailyLogCatalog } from "../../src/daily-log-catalog/catalog.js";
import type { SubstitutionTokens } from "../../src/daily-log-catalog/types.js";

// Section 2 rebuild (spec v2.4): verifies the context-based arrangement
// branching added to catalog.ts for the fields shared between
// formal_schooling and home_learning (attended_on_time/reason_for_lateness/
// progress_from_school/school_attachments), plus each arrangement's gate
// visibility. Mirrors education_question_sets.ts/.dart's own content --
// this is the live-catalog path those files check first.

const tokens: SubstitutionTokens = {
  they: "Alex",
  possessive: "Alex's",
  wasWere: "was",
};

function entry(id: string) {
  const found = dailyLogCatalog.fields[id];
  if (!found) throw new Error(`catalog missing entry for ${id}`);
  return found;
}

describe("Education catalog entries (Section 2 rebuild)", () => {
  it("attended_school is visible only under formal_schooling", () => {
    const field = entry("attended_school");
    expect(
      resolveVisible(field, {
        answers: {},
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(field, {
        answers: {},
        context: { educationArrangementId: "home_learning" },
      }),
    ).toBe(false);
  });

  it("attended_on_time wording and visibility branch on which arrangement's gate is Yes", () => {
    const field = entry("attended_on_time");

    expect(
      resolveQuestion(
        field,
        { answers: {}, context: { educationArrangementId: "formal_schooling" } },
        tokens,
      ),
    ).toBe("Was Alex on time for school today?");
    expect(
      resolveQuestion(
        field,
        { answers: {}, context: { educationArrangementId: "home_learning" } },
        tokens,
      ),
    ).toBe("Was Alex on time for home learning or tuition today?");

    expect(
      resolveVisible(field, {
        answers: { attended_school: "Yes" },
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(field, {
        answers: { attended_school: "No" },
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(false);
    expect(
      resolveVisible(field, {
        answers: { home_learning_attended: "Yes" },
        context: { educationArrangementId: "home_learning" },
      }),
    ).toBe(true);
    // Wrong context even with a matching answer present must not leak
    // visibility -- the exact-match discipline this whole project exists
    // to enforce.
    expect(
      resolveVisible(field, {
        answers: { home_learning_attended: "Yes" },
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(false);
  });

  it("reason_for_lateness requires both the right arrangement's gate=Yes and on-time=No", () => {
    const field = entry("reason_for_lateness");
    expect(
      resolveVisible(field, {
        answers: { attended_school: "Yes", attended_on_time: "No" },
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(field, {
        answers: { attended_school: "Yes", attended_on_time: "Yes" },
        context: { educationArrangementId: "formal_schooling" },
      }),
    ).toBe(false);
    expect(
      resolveVisible(field, {
        answers: { home_learning_attended: "Yes", attended_on_time: "No" },
        context: { educationArrangementId: "home_learning" },
      }),
    ).toBe(true);
  });

  it("each arrangement's wholly-synthetic gate is scoped to its own context only", () => {
    expect(
      resolveVisible(entry("nursery_attended"), {
        answers: {},
        context: { educationArrangementId: "early_years" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(entry("nursery_attended"), {
        answers: {},
        context: { educationArrangementId: "sixteen_plus" },
      }),
    ).toBe(false);
    expect(
      resolveVisible(entry("eet_attended"), {
        answers: {},
        context: { educationArrangementId: "sixteen_plus" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(entry("learning_development_participated"), {
        answers: {},
        context: { educationArrangementId: "not_in_eet" },
      }),
    ).toBe(true);
  });

  it("early_years comments/photos always show once in that arrangement, regardless of the gate answer", () => {
    expect(
      resolveVisible(entry("nursery_comments"), {
        answers: {},
        context: { educationArrangementId: "early_years" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(entry("nursery_attachments"), {
        answers: { nursery_attended: "Not scheduled today" },
        context: { educationArrangementId: "early_years" },
      }),
    ).toBe(true);
  });

  it("learning_development_details requires the participation gate to be Yes", () => {
    const field = entry("learning_development_details");
    expect(
      resolveVisible(field, {
        answers: { learning_development_participated: "Yes" },
        context: { educationArrangementId: "not_in_eet" },
      }),
    ).toBe(true);
    expect(
      resolveVisible(field, {
        answers: { learning_development_participated: "No" },
        context: { educationArrangementId: "not_in_eet" },
      }),
    ).toBe(false);
  });
});
