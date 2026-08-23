import { describe, expect, it } from "vitest";
import {
  FIRST_SEAT_PERIOD_KEY,
  hasAnySeatInvoice,
  licencePeriodsDue,
  periodsNeedingPayment,
  seatPaymentIdempotencyKey,
} from "../../src/lib/billing-periods.js";

const seatInvoice = (periodStart: string) => ({
  line_items: [{ code: "agency_admin" }],
  period_start: periodStart,
});

const setupInvoice = {
  line_items: [{ code: "setup_fee" }],
  period_start: "2026-08-18",
};

describe("licencePeriodsDue", () => {
  it("only queues the first collection before a cycle anchor exists", () => {
    const due = licencePeriodsDue({
      billingCycleAnchor: null,
      today: "2026-08-19",
    });
    expect(due).toHaveLength(1);
    expect(due[0]?.key).toBe(FIRST_SEAT_PERIOD_KEY);
    expect(due[0]?.start).toBe("2026-08-19");
    expect(due[0]?.end).toBe("2026-09-18");
  });

  it("includes every started period from the anchor through today", () => {
    const due = licencePeriodsDue({
      billingCycleAnchor: "2026-08-24",
      today: "2026-10-25",
    });
    expect(due.map((p) => p.start)).toEqual([
      "2026-08-24",
      "2026-09-24",
      "2026-10-24",
    ]);
    expect(due[0]?.key).toBe(FIRST_SEAT_PERIOD_KEY);
    expect(due[1]?.key).toBe("2026-09-24");
  });

  it("does not queue a future anniversary", () => {
    const due = licencePeriodsDue({
      billingCycleAnchor: "2026-08-24",
      today: "2026-09-23",
    });
    expect(due.map((p) => p.start)).toEqual(["2026-08-24"]);
  });
});

describe("periodsNeedingPayment", () => {
  it("skips first collection when any seat invoice exists", () => {
    expect(
      periodsNeedingPayment({
        billingCycleAnchor: null,
        today: "2026-08-19",
        invoices: [seatInvoice("2026-08-19")],
      }),
    ).toEqual([]);
  });

  it("ignores setup-fee invoices when deciding the first collection", () => {
    const due = periodsNeedingPayment({
      billingCycleAnchor: null,
      today: "2026-08-19",
      invoices: [setupInvoice],
    });
    expect(due).toHaveLength(1);
    expect(due[0]?.key).toBe(FIRST_SEAT_PERIOD_KEY);
  });

  it("creates later months when the first invoice already exists", () => {
    const due = periodsNeedingPayment({
      billingCycleAnchor: "2026-08-24",
      today: "2026-10-25",
      invoices: [seatInvoice("2026-08-24")],
    });
    expect(due.map((p) => p.start)).toEqual(["2026-09-24", "2026-10-24"]);
  });
});

describe("seat helpers", () => {
  it("does not treat setup fee as a seat invoice", () => {
    expect(hasAnySeatInvoice([setupInvoice])).toBe(false);
    expect(hasAnySeatInvoice([seatInvoice("2026-08-24")])).toBe(true);
  });

  it("builds a stable GoCardless idempotency key", () => {
    expect(seatPaymentIdempotencyKey("agency-1", "first")).toBe(
      "seats:agency-1:first",
    );
  });
});
