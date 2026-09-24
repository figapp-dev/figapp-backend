import { describe, expect, it } from "vitest";
import { requiredEducationFieldIds } from "../../src/lib/education-question-fields.js";

describe("requiredEducationFieldIds", () => {
  it("formal_schooling: gate always required; on-time only once attended=Yes; late reason only once on-time=No", () => {
    expect([...requiredEducationFieldIds("formal_schooling", {})]).toEqual([
      "attended_school",
    ]);
    expect([
      ...requiredEducationFieldIds("formal_schooling", { attended_school: "Yes" }),
    ]).toEqual(["attended_school", "attended_on_time"]);
    expect([
      ...requiredEducationFieldIds("formal_schooling", {
        attended_school: "Yes",
        attended_on_time: "No",
      }),
    ]).toEqual(["attended_school", "attended_on_time", "reason_for_lateness"]);
    expect([
      ...requiredEducationFieldIds("formal_schooling", { attended_school: "No" }),
    ]).toEqual(["attended_school", "reason_for_absence"]);
  });

  it("a gate answer that means 'not applicable' (School Holiday) requires nothing further", () => {
    expect([
      ...requiredEducationFieldIds("formal_schooling", {
        attended_school: "School Holiday",
      }),
    ]).toEqual(["attended_school"]);
  });

  it("home_learning uses its own new gate/reason ids, but shares on-time/lateness with formal_schooling", () => {
    expect([
      ...requiredEducationFieldIds("home_learning", {
        home_learning_attended: "No",
      }),
    ]).toEqual(["home_learning_attended", "home_learning_absence_reason"]);
    expect([
      ...requiredEducationFieldIds("home_learning", {
        home_learning_attended: "Yes",
        attended_on_time: "No",
      }),
    ]).toEqual([
      "home_learning_attended",
      "attended_on_time",
      "reason_for_lateness",
    ]);
  });

  it("early_years and sixteen_plus use their own wholly-synthetic ids", () => {
    expect([
      ...requiredEducationFieldIds("early_years", { nursery_attended: "No" }),
    ]).toEqual(["nursery_attended", "nursery_absence_reason"]);
    expect([
      ...requiredEducationFieldIds("sixteen_plus", { eet_attended: "Yes" }),
    ]).toEqual(["eet_attended", "eet_on_time"]);
  });

  it("not_in_eet: participation gate always required, details only required when Yes", () => {
    expect([...requiredEducationFieldIds("not_in_eet", {})]).toEqual([
      "learning_development_participated",
    ]);
    expect([
      ...requiredEducationFieldIds("not_in_eet", {
        learning_development_participated: "Yes",
      }),
    ]).toEqual([
      "learning_development_participated",
      "learning_development_details",
    ]);
    expect([
      ...requiredEducationFieldIds("not_in_eet", {
        learning_development_participated: "No",
      }),
    ]).toEqual(["learning_development_participated"]);
  });
});
