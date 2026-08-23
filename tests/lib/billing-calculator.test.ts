import { describe, expect, it } from "vitest";
import {
  SETUP_FEE_DEFAULT_GBP,
  STARTER_PACK_SEATS,
  availableSeats,
  calculateProRataPence,
  calculateSetupFeePence,
  canReducePurchasedSeats,
  daysInBillingCycle,
  fosterPurchasedSeatsMonthlyPence,
  gbpToPence,
  minPurchasedSeatsAllowed,
  nextFosterSeatMonthlyGbp,
  periodEndFromAnchor,
  quotePurchasedSeats,
  quoteStarterPack,
  starterPackTenantLicenceSeed,
} from "../../src/lib/billing-calculator.js";

describe("billingCalculator", () => {
  it("computes available seats", () => {
    expect(availableSeats({ purchased: 10, used: 3, pendingInvites: 2 })).toBe(5);
    expect(availableSeats({ purchased: 1, used: 1, pendingInvites: 0 })).toBe(0);
  });

  it("enforces starter-pack floor for reductions", () => {
    expect(minPurchasedSeatsAllowed("foster_carer", 0, 0)).toBe(
      STARTER_PACK_SEATS.foster_carer,
    );
    expect(minPurchasedSeatsAllowed("social_worker", 2, 1)).toBe(3);
    expect(
      canReducePurchasedSeats({
        licenceCode: "foster_carer",
        currentPurchased: 12,
        targetPurchased: 10,
        used: 8,
        pendingInvites: 0,
      }),
    ).toBe(true);
    expect(
      canReducePurchasedSeats({
        licenceCode: "foster_carer",
        currentPurchased: 12,
        targetPurchased: 9,
        used: 8,
        pendingInvites: 0,
      }),
    ).toBe(false);
  });

  it("calculates setup fee after discount", () => {
    expect(calculateSetupFeePence({ selected: false })).toBe(0);
    expect(calculateSetupFeePence({ selected: true })).toBe(
      gbpToPence(SETUP_FEE_DEFAULT_GBP),
    );
    expect(calculateSetupFeePence({ selected: true, discountPercent: 100 })).toBe(0);
    expect(calculateSetupFeePence({ selected: true, discountPercent: 50 })).toBe(
      gbpToPence(SETUP_FEE_DEFAULT_GBP) / 2,
    );
  });

  it("pro-rates remaining days in a 30-day cycle", () => {
    const start = new Date(Date.UTC(2026, 7, 1));
    const end = new Date(Date.UTC(2026, 7, 30));
    expect(daysInBillingCycle(start, end)).toBe(30);
    const mid = new Date(Date.UTC(2026, 7, 16));
    expect(
      calculateProRataPence({
        monthlyPriceGbp: 20,
        periodStart: start,
        periodEnd: end,
        asOf: mid,
      }),
    ).toBe(1000);
  });

  it("prices foster seats as first + additional", () => {
    expect(
      fosterPurchasedSeatsMonthlyPence({
        seats: 10,
        priceMonthlyGbp: 20,
        priceAdditionalGbp: 5,
      }),
    ).toBe(6500);
    expect(
      nextFosterSeatMonthlyGbp({
        currentPurchased: 0,
        priceMonthlyGbp: 20,
        priceAdditionalGbp: 5,
      }),
    ).toBe(20);
    expect(
      nextFosterSeatMonthlyGbp({
        currentPurchased: 3,
        priceMonthlyGbp: 20,
        priceAdditionalGbp: 5,
      }),
    ).toBe(5);
  });

  it("quotes the starter pack including optional setup fee", () => {
    const quote = quoteStarterPack({
      prices: [
        { code: "agency_admin", priceMonthly: 50 },
        { code: "social_worker_manager", priceMonthly: 40 },
        { code: "social_worker", priceMonthly: 30 },
        { code: "foster_carer", priceMonthly: 20, priceAdditional: 5 },
      ],
      setupFeeSelected: true,
      setupFeeDiscountPercent: 0,
    });
    expect(quote.monthlyTotalPence).toBe(50_00 + 40_00 + 30_00 + 65_00);
    expect(quote.setupFeePence).toBe(499_00);
    expect(quote.dueNowPence).toBe(quote.monthlyTotalPence + quote.setupFeePence);
    expect(starterPackTenantLicenceSeed()).toHaveLength(4);
  });

  it("quotes purchased seats for the subscription amount", () => {
    const quote = quotePurchasedSeats({
      prices: [
        { code: "agency_admin", priceMonthly: 60 },
        { code: "social_worker_manager", priceMonthly: 40 },
        { code: "social_worker", priceMonthly: 35 },
        { code: "foster_carer", priceMonthly: 20, priceAdditional: 5 },
      ],
      seats: {
        agency_admin: 1,
        social_worker_manager: 1,
        social_worker: 1,
        foster_carer: 10,
      },
    });
    expect(quote.monthlyTotalPence).toBe(60_00 + 40_00 + 35_00 + 65_00);
  });

  it("computes inclusive period end from the cycle anchor", () => {
    expect(periodEndFromAnchor("2026-08-13")).toBe("2026-09-12");
    expect(periodEndFromAnchor("2026-01-31")).toBe("2026-02-27");
  });
});
