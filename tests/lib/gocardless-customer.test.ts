import { describe, expect, it } from "vitest";
import {
  completeGoCardlessAddress,
  goCardlessCustomerCreateParams,
  goCardlessPrefilledCustomer,
  friendlyGoCardlessStartError,
} from "../../src/lib/gocardless-customer.js";

const completeAgency = {
  id: "agency-1",
  name: "Care I Wish",
  address_line1: "Tarn Hows Walk",
  city: "Pontefract",
  postal_code: "WF8 3RJ",
};

describe("completeGoCardlessAddress", () => {
  it("returns GB address fields only when line 1, city and postcode are all present", () => {
    expect(completeGoCardlessAddress(completeAgency)).toEqual({
      address_line1: "Tarn Hows Walk",
      city: "Pontefract",
      postal_code: "WF8 3RJ",
      country_code: "GB",
    });
  });

  it("omits a partial address so GoCardless hosted checkout can collect it", () => {
    expect(
      completeGoCardlessAddress({
        ...completeAgency,
        postal_code: null,
      }),
    ).toBeNull();
    expect(
      completeGoCardlessAddress({
        ...completeAgency,
        postal_code: "  ",
      }),
    ).toBeNull();
    expect(
      completeGoCardlessAddress({
        address_line1: null,
        city: "Pontefract",
        postal_code: "WF8 3RJ",
      }),
    ).toBeNull();
  });
});

describe("goCardlessCustomerCreateParams", () => {
  it("does not send street/city without a postcode", () => {
    const params = goCardlessCustomerCreateParams(
      { ...completeAgency, postal_code: null },
      "billing@example.com",
    );
    expect(params).toEqual({
      email: "billing@example.com",
      company_name: "Care I Wish",
      country_code: "GB",
      metadata: { agency_id: "agency-1" },
    });
    expect(params).not.toHaveProperty("address_line1");
    expect(params).not.toHaveProperty("city");
    expect(params).not.toHaveProperty("postal_code");
  });

  it("includes the full address when complete", () => {
    expect(goCardlessCustomerCreateParams(completeAgency, "billing@example.com")).toEqual({
      email: "billing@example.com",
      company_name: "Care I Wish",
      country_code: "GB",
      address_line1: "Tarn Hows Walk",
      city: "Pontefract",
      postal_code: "WF8 3RJ",
      metadata: { agency_id: "agency-1" },
    });
  });
});

describe("goCardlessPrefilledCustomer", () => {
  it("omits a null email instead of sending email: null", () => {
    expect(goCardlessPrefilledCustomer({ name: "Care I Wish" }, null)).toEqual({
      company_name: "Care I Wish",
      country_code: "GB",
    });
  });
});

describe("friendlyGoCardlessStartError", () => {
  it("maps missing postcode validation to a clear Direct Debit message", () => {
    expect(
      friendlyGoCardlessStartError(
        new Error("validation_failed: postal_code: must be provided"),
      ),
    ).toMatch(/postcode/i);
  });
});
