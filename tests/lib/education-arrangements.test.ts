import { describe, expect, it } from "vitest";
import {
  EDUCATION_ARRANGEMENT_SNAPSHOT_KEY,
  canonicalEducationArrangementId,
  resolveEducationArrangementForLog,
  schoolSectionTitleFor,
  withEducationArrangementSnapshot,
} from "../../src/lib/education-arrangements.js";

describe("canonicalEducationArrangementId", () => {
  it("maps every canonical label to its exact id", () => {
    expect(canonicalEducationArrangementId("Formal Schooling")).toBe(
      "formal_schooling",
    );
    expect(canonicalEducationArrangementId("Home Learning or Tuition")).toBe(
      "home_learning",
    );
    expect(
      canonicalEducationArrangementId("Early Years or Not Yet School Age"),
    ).toBe("early_years");
    expect(
      canonicalEducationArrangementId(
        "16+ Education, Employment or Training",
      ),
    ).toBe("sixteen_plus");
    expect(
      canonicalEducationArrangementId(
        "Not currently in education, employment or training",
      ),
    ).toBe("not_in_eet");
  });

  it("does not let the new value fall into the old 16+ substring bucket", () => {
    // The whole reason for exact-match canonicalization over the old
    // substring checks: "Not currently in education, employment or
    // training" contains "employment" and "training", the exact substrings
    // the old isSchoolEducationSectionDisabled used to detect 16+.
    expect(
      canonicalEducationArrangementId(
        "Not currently in education, employment or training",
      ),
    ).not.toBe("sixteen_plus");
  });

  it("resolves pre-v2.4 slash-form and legacy labels to the same id", () => {
    expect(canonicalEducationArrangementId("Home Learning / Tuition")).toBe(
      "home_learning",
    );
    expect(canonicalEducationArrangementId("Home Learning/Tuitions")).toBe(
      "home_learning",
    );
    expect(
      canonicalEducationArrangementId("Early Years / Not Yet School Age"),
    ).toBe("early_years");
    expect(canonicalEducationArrangementId("16+ (in work/trade)")).toBe(
      "sixteen_plus",
    );
  });

  it("falls back to formal_schooling for empty or unrecognized values", () => {
    expect(canonicalEducationArrangementId(null)).toBe("formal_schooling");
    expect(canonicalEducationArrangementId(undefined)).toBe(
      "formal_schooling",
    );
    expect(canonicalEducationArrangementId("")).toBe("formal_schooling");
    expect(canonicalEducationArrangementId("Something made up")).toBe(
      "formal_schooling",
    );
  });
});

describe("schoolSectionTitleFor", () => {
  it("returns the arrangement-aware carer-facing title", () => {
    expect(schoolSectionTitleFor("formal_schooling")).toBe("School");
    expect(schoolSectionTitleFor("home_learning")).toBe(
      "Home Learning or Tuition",
    );
    expect(schoolSectionTitleFor("early_years")).toBe("Early Years");
    expect(schoolSectionTitleFor("sixteen_plus")).toBe(
      "Education, Employment or Training",
    );
    expect(schoolSectionTitleFor("not_in_eet")).toBe("Learning & Development");
  });
});

describe("withEducationArrangementSnapshot / resolveEducationArrangementForLog", () => {
  it("stamps the arrangement into a fresh dataJson", () => {
    const stamped = withEducationArrangementSnapshot({ foo: "bar" }, "Formal Schooling");
    expect(stamped[EDUCATION_ARRANGEMENT_SNAPSHOT_KEY]).toBe("Formal Schooling");
    expect(stamped.foo).toBe("bar");
  });

  it("never overwrites an existing snapshot", () => {
    const dataJson = { [EDUCATION_ARRANGEMENT_SNAPSHOT_KEY]: "Home Learning or Tuition" };
    const stamped = withEducationArrangementSnapshot(dataJson, "Formal Schooling");
    expect(stamped[EDUCATION_ARRANGEMENT_SNAPSHOT_KEY]).toBe(
      "Home Learning or Tuition",
    );
  });

  it("does not stamp when there is no arrangement to freeze", () => {
    const dataJson = { foo: "bar" };
    const stamped = withEducationArrangementSnapshot(dataJson, null);
    expect(stamped).toBe(dataJson);
    expect(EDUCATION_ARRANGEMENT_SNAPSHOT_KEY in stamped).toBe(false);
  });

  it("prefers the frozen snapshot over a live value that has since changed", () => {
    const dataJson = { [EDUCATION_ARRANGEMENT_SNAPSHOT_KEY]: "Home Learning or Tuition" };
    expect(
      resolveEducationArrangementForLog(dataJson, "16+ Education, Employment or Training"),
    ).toBe("Home Learning or Tuition");
  });

  it("falls back to the live value when a log predates the snapshot", () => {
    expect(resolveEducationArrangementForLog({}, "Formal Schooling")).toBe(
      "Formal Schooling",
    );
    expect(resolveEducationArrangementForLog(null, "Formal Schooling")).toBe(
      "Formal Schooling",
    );
  });
});
