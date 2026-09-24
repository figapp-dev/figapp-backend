import { describe, expect, it } from "vitest";
import {
  mergeRowScope,
  resolveQuestion,
  resolveSuggestions,
  resolveVisible,
} from "../../src/daily-log-catalog/resolve.js";
import { chooseCatalog } from "../../src/daily-log-catalog/versioning.js";
import type {
  CatalogDocument,
  CatalogEntry,
  SubstitutionTokens,
} from "../../src/daily-log-catalog/types.js";

// Shared fixture: ported verbatim to Flutter's test suite in Phase B so the
// two independently hand-written interpreters can't silently drift apart.
// Canonical arrangement ids only (home_learning, early_years, ...) --
// resolve.ts never sees a raw profile string; that mapping is written
// separately in Phase A step 2, alongside the school catalog fields.

const tokens: SubstitutionTokens = {
  they: "Alex",
  possessive: "Alex's",
  wasWere: "was",
};

const attendedSchool: CatalogEntry = {
  fieldId: "attended_school",
  question: {
    default: "Did {they} attend school today?",
    variants: [
      {
        when: { context: "educationArrangement", equals: "home_learning" },
        text: "Did {they} attend home learning or tuition today?",
      },
    ],
  },
  // notIn (denylist), not an allowlist: a null/unset arrangement must stay
  // visible, matching today's "no arrangement set -> still show Formal
  // Schooling" fallback.
  visibleWhen: {
    context: "educationArrangement",
    notIn: ["early_years", "sixteen_plus", "employment_training"],
  },
};

const breakfastDetails: CatalogEntry = {
  fieldId: "breakfast_details",
  question: {
    default: "What did {they} have for breakfast?",
    variants: [
      {
        when: { field: "breakfast", equals: "No" },
        text: "Why didn't {they} have breakfast this morning?",
      },
    ],
  },
  visibleWhen: { field: "breakfast", in: ["Yes", "No"] },
  suggestions: {
    default: ["No comments"],
    variants: [
      {
        when: { field: "breakfast", equals: "No" },
        phrases: ["Ran out of time", "Woke up too late"],
      },
    ],
  },
};

const appointmentComments: CatalogEntry = {
  fieldId: "comments",
  question: {
    default: "Would you like to add anything about this appointment?",
  },
  suggestions: {
    default: [],
    variants: [
      {
        when: { field: "type", equals: "Dentist" },
        phrases: ["No issues found", "Follow-up in 6 months"],
      },
    ],
  },
};

describe("daily-log-catalog resolve", () => {
  it("1. null/unset arrangement with a notIn condition stays visible (still has school)", () => {
    const scope = { answers: {}, context: {} };
    expect(resolveVisible(attendedSchool, scope)).toBe(true);
  });

  it("2. home learning arrangement selects the correct wording variant", () => {
    const scope = { answers: {}, context: { educationArrangement: "home_learning" } };
    expect(resolveQuestion(attendedSchool, scope, tokens)).toBe(
      "Did Alex attend home learning or tuition today?",
    );
  });

  it("3. early years arrangement hides the field", () => {
    const scope = { answers: {}, context: { educationArrangement: "early_years" } };
    expect(resolveVisible(attendedSchool, scope)).toBe(false);
  });

  it("4. a suggestion variant matches, not just the default list", () => {
    const scope = { answers: { breakfast: "No" } };
    expect(resolveSuggestions(breakfastDetails, scope, tokens)).toEqual([
      "Ran out of time",
      "Woke up too late",
    ]);
  });

  it("5. a repeatable row resolves type-scoped conditions against the row, not the parent log", () => {
    const parentAnswers = { breakfast: "Yes" };
    const rowAnswers = { type: "Dentist", time: "09:30" };

    const mergedScope = { answers: mergeRowScope(parentAnswers, rowAnswers) };
    expect(resolveSuggestions(appointmentComments, mergedScope, tokens)).toEqual([
      "No issues found",
      "Follow-up in 6 months",
    ]);

    // Without the merge, "type" isn't in scope and the variant can't match --
    // proves the row-scoping is load-bearing, not incidental.
    const parentOnlyScope = { answers: parentAnswers };
    expect(resolveSuggestions(appointmentComments, parentOnlyScope, tokens)).toEqual([]);
  });

  it("6. a schemaVersion the consuming app does not understand is rejected, falls back to the bundled seed", () => {
    const fetched: CatalogDocument = { schemaVersion: 2, catalogVersion: 99, fields: {} };
    const bundled: CatalogDocument = { schemaVersion: 1, catalogVersion: 10, fields: {} };
    expect(chooseCatalog(fetched, bundled)).toBe(bundled);
  });

  it("7. a fetched catalog with a higher catalogVersion than the bundled seed wins", () => {
    const fetched: CatalogDocument = { schemaVersion: 1, catalogVersion: 47, fields: {} };
    const bundled: CatalogDocument = { schemaVersion: 1, catalogVersion: 10, fields: {} };
    expect(chooseCatalog(fetched, bundled)).toBe(fetched);

    // And the reverse: the seed wins if it's actually the newer one.
    const olderFetched: CatalogDocument = { schemaVersion: 1, catalogVersion: 3, fields: {} };
    expect(chooseCatalog(olderFetched, bundled)).toBe(bundled);
  });
});
