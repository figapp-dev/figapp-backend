import {
  addCalendarMonthsUtc,
  formatDateOnly,
  periodEndFromAnchor,
} from "./billing-calculator.js";
import { toDateOnly } from "./dates.js";

export const FIRST_SEAT_PERIOD_KEY = "first";

export type LicencePeriod = {
  /** `first` until cycle dates exist; then the period start (YYYY-MM-DD). */
  key: string;
  start: string;
  end: string;
};

export function invoiceHasSetupFee(lineItems: unknown): boolean {
  if (!Array.isArray(lineItems)) return false;
  return lineItems.some(
    (item) =>
      !!item &&
      typeof item === "object" &&
      "code" in item &&
      (item as { code?: unknown }).code === "setup_fee",
  );
}

export function isSeatLicenceInvoice(lineItems: unknown): boolean {
  return !invoiceHasSetupFee(lineItems);
}

export function hasAnySeatInvoice(
  invoices: Array<{ line_items: unknown }>,
): boolean {
  return invoices.some((row) => isSeatLicenceInvoice(row.line_items));
}

export function hasSeatInvoiceForPeriod(
  invoices: Array<{ line_items: unknown; period_start: string }>,
  periodStart: string,
): boolean {
  return invoices.some(
    (row) =>
      isSeatLicenceInvoice(row.line_items) &&
      toDateOnly(row.period_start) === periodStart,
  );
}

/**
 * Licence periods that should already have been billed as of `today` (YYYY-MM-DD).
 * No cycle anchor → only the first collection is due (catch-up after mandate).
 */
export function licencePeriodsDue(params: {
  billingCycleAnchor: string | null;
  today: string;
  maxPeriods?: number;
}): LicencePeriod[] {
  const today = params.today.slice(0, 10);
  const maxPeriods = params.maxPeriods ?? 24;
  const anchor = toDateOnly(params.billingCycleAnchor);

  if (!anchor) {
    return [
      {
        key: FIRST_SEAT_PERIOD_KEY,
        start: today,
        end: periodEndFromAnchor(today),
      },
    ];
  }

  const due: LicencePeriod[] = [];
  for (let n = 0; n < maxPeriods; n += 1) {
    const start = formatDateOnly(addCalendarMonthsUtc(anchor, n));
    if (start > today) break;
    due.push({
      key: n === 0 ? FIRST_SEAT_PERIOD_KEY : start,
      start,
      end: periodEndFromAnchor(start),
    });
  }
  return due;
}

/** Periods that still need a GoCardless one-off (no matching seat invoice). */
export function periodsNeedingPayment(params: {
  billingCycleAnchor: string | null;
  today: string;
  invoices: Array<{ line_items: unknown; period_start: string }>;
}): LicencePeriod[] {
  return licencePeriodsDue(params).filter((period) => {
    if (period.key === FIRST_SEAT_PERIOD_KEY) {
      return !hasAnySeatInvoice(params.invoices);
    }
    return !hasSeatInvoiceForPeriod(params.invoices, period.start);
  });
}

export function seatPaymentIdempotencyKey(
  agencyId: string,
  periodKey: string,
): string {
  return `seats:${agencyId}:${periodKey}`;
}
