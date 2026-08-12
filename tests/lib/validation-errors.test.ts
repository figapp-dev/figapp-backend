import { describe, expect, it } from "vitest";
import { formatValidationMessage } from "../../src/lib/validation-errors.js";

describe("formatValidationMessage", () => {
  it("formats required fields", () => {
    expect(
      formatValidationMessage([
        {
          keyword: "required",
          instancePath: "",
          params: { missingProperty: "dataJson" },
        },
      ]),
    ).toBe("dataJson is required");
  });

  it("formats enums", () => {
    expect(
      formatValidationMessage([
        {
          keyword: "enum",
          instancePath: "/intent",
          params: { allowedValues: ["save", "submit"] },
        },
      ]),
    ).toBe("intent must be one of: save, submit");
  });

  it("formats types and unknown fields", () => {
    expect(
      formatValidationMessage([
        {
          keyword: "type",
          instancePath: "/dataJson",
          params: { type: "object" },
        },
      ]),
    ).toBe("dataJson must be an object");

    expect(
      formatValidationMessage([
        {
          keyword: "additionalProperties",
          instancePath: "",
          params: { additionalProperty: "extra" },
        },
      ]),
    ).toBe("Unknown field: extra");
  });

  it("formats empty strings and minima", () => {
    expect(
      formatValidationMessage([
        {
          keyword: "minLength",
          instancePath: "/fieldId",
          params: { limit: 1 },
        },
      ]),
    ).toBe("fieldId must not be empty");

    expect(
      formatValidationMessage([
        {
          keyword: "minimum",
          instancePath: "/expiresIn",
          params: { limit: 1 },
        },
      ]),
    ).toBe("expiresIn must be at least 1");
  });

  it("falls back when validation is empty", () => {
    expect(formatValidationMessage([])).toBe("Request validation failed");
  });
});
