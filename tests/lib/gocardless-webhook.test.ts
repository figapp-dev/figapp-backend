import { describe, expect, it } from "vitest";
import {
  agencyIdFromGcMetadata,
  gocardlessEventResourceId,
} from "../../src/lib/gocardless-webhook.js";

describe("gocardless webhook parse helpers", () => {
  it("reads agency_id from metadata", () => {
    expect(agencyIdFromGcMetadata({ agency_id: " ag-1 " })).toBe("ag-1");
    expect(agencyIdFromGcMetadata({ agency_id: 1 })).toBeNull();
    expect(agencyIdFromGcMetadata(null)).toBeNull();
  });

  it("picks the first linked resource id", () => {
    expect(
      gocardlessEventResourceId({
        links: { payment: "PM01", mandate: "MD01" },
      }),
    ).toBe("PM01");
    expect(
      gocardlessEventResourceId({
        links: { mandate: "MD01" },
      }),
    ).toBe("MD01");
    expect(gocardlessEventResourceId({ links: {} })).toBeNull();
  });
});
