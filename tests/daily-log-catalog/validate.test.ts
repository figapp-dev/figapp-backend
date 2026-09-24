import { describe, expect, it } from "vitest";
import { dailyLogCatalog } from "../../src/daily-log-catalog/catalog.js";
import { validateCatalog } from "../../src/daily-log-catalog/validate.js";
import type { CatalogDocument } from "../../src/daily-log-catalog/types.js";

function baseDoc(fields: CatalogDocument["fields"]): CatalogDocument {
  return { schemaVersion: 1, catalogVersion: 1, fields };
}

describe("validateCatalog", () => {
  it("the real authored catalog is valid -- the actual build gate", () => {
    expect(validateCatalog(dailyLogCatalog)).toEqual([]);
  });

  it("flags a fieldId that doesn't match its own object key", () => {
    const doc = baseDoc({
      breakfast: { fieldId: "wrong_id", question: { default: "x" } },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.breakfast: fieldId "wrong_id" does not match its own key',
    ]);
  });

  it("flags a when.field that references an unknown top-level id", () => {
    const doc = baseDoc({
      breakfast_details: {
        fieldId: "breakfast_details",
        question: {
          default: "x",
          variants: [{ when: { field: "brekfast", equals: "No" }, text: "y" }],
        },
      },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.breakfast_details.question.variants[0]: references unknown field id "brekfast"',
    ]);
  });

  it("allows a repeatableFields condition to reference a sibling row id", () => {
    const doc = baseDoc({
      appointments: {
        fieldId: "appointments",
        question: { default: "x" },
        repeatableFields: [
          { fieldId: "type", question: { default: "y" } },
          {
            fieldId: "comments",
            question: { default: "z" },
            suggestions: {
              default: [],
              variants: [{ when: { field: "type", equals: "Dentist" }, phrases: ["a"] }],
            },
          },
        ],
      },
    });
    expect(validateCatalog(doc)).toEqual([]);
  });

  it("flags a repeatableFields condition referencing a field outside its own group", () => {
    const doc = baseDoc({
      appointments: {
        fieldId: "appointments",
        question: { default: "x" },
        repeatableFields: [
          {
            fieldId: "comments",
            question: { default: "z" },
            suggestions: {
              default: [],
              variants: [{ when: { field: "mode", equals: "Phone Call" }, phrases: ["a"] }],
            },
          },
        ],
      },
      contacts: {
        fieldId: "contacts",
        question: { default: "x" },
        repeatableFields: [{ fieldId: "mode", question: { default: "y" } }],
      },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.appointments.repeatableFields.comments.suggestions.variants[0]: references unknown field id "mode"',
    ]);
  });

  it("flags a duplicate fieldId within the same repeatableFields array", () => {
    const doc = baseDoc({
      appointments: {
        fieldId: "appointments",
        question: { default: "x" },
        repeatableFields: [
          { fieldId: "comments", question: { default: "a" } },
          { fieldId: "comments", question: { default: "b" } },
        ],
      },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.appointments.repeatableFields: duplicate fieldId "comments"',
    ]);
  });

  it("flags a non-canonical educationArrangement value", () => {
    const doc = baseDoc({
      attended_school: {
        fieldId: "attended_school",
        question: { default: "x" },
        visibleWhen: { context: "educationArrangement", notIn: ["home_shooling"] },
      },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.attended_school.visibleWhen: non-canonical arrangement id "home_shooling"',
    ]);
  });

  it("accepts a canonical educationArrangement value", () => {
    const doc = baseDoc({
      attended_school: {
        fieldId: "attended_school",
        question: { default: "x" },
        visibleWhen: {
          context: "educationArrangement",
          notIn: ["early_years", "sixteen_plus", "employment_training"],
        },
      },
    });
    expect(validateCatalog(doc)).toEqual([]);
  });

  it("recurses into all/any compound conditions", () => {
    const doc = baseDoc({
      reason_for_lateness: {
        fieldId: "reason_for_lateness",
        question: { default: "x" },
        visibleWhen: {
          all: [
            { field: "attended_school", equals: "Yes" },
            { any: [{ field: "attended_on_tim", equals: "No" }] },
          ],
        },
      },
      attended_school: { fieldId: "attended_school", question: { default: "y" } },
    });
    expect(validateCatalog(doc)).toEqual([
      'fields.reason_for_lateness.visibleWhen.all[1].any[0]: references unknown field id "attended_on_tim"',
    ]);
  });
});
