/**
 * GoCardless billing calculator — ported from figapp-new
 * `modules/billing/utils/billingCalculator.ts`. Keep behaviour identical.
 */

export type BillableLicenceCode =
  | "agency_admin"
  | "social_worker_manager"
  | "social_worker"
  | "foster_carer";

/** App user_role → licence_types.code */
export const ROLE_TO_LICENCE_CODE: Record<string, BillableLicenceCode | null> = {
  agency_admin: "agency_admin",
  sw_manager: "social_worker_manager",
  social_worker: "social_worker",
  foster_carer: "foster_carer",
  child: null,
  child_ovr13: null,
  child_und13: null,
  super_admin: null,
  app_admin: null,
};

export const BILLABLE_LICENCE_CODES = [
  "agency_admin",
  "social_worker_manager",
  "social_worker",
  "foster_carer",
] as const satisfies readonly BillableLicenceCode[];

export const STARTER_PACK_SEATS: Readonly<Record<BillableLicenceCode, number>> =
  {
    agency_admin: 1,
    social_worker_manager: 1,
    social_worker: 1,
    foster_carer: 10,
  };

export const SETUP_FEE_DEFAULT_GBP = 499;

export const LICENCE_LABELS: Record<BillableLicenceCode, string> = {
  agency_admin: "Agency Admin",
  social_worker_manager: "SW Manager",
  social_worker: "Social Worker",
  foster_carer: "Foster Carer",
};

export type LicencePrice = {
  code: BillableLicenceCode;
  /** Monthly GBP (major units), e.g. 20.00 */
  priceMonthly: number;
  /** Optional additional foster-carer rate in GBP */
  priceAdditional?: number | null;
};

export type SeatCounts = {
  purchased: number;
  used: number;
  pendingInvites: number;
};

export type MoneyLineItem = {
  code: BillableLicenceCode | "setup_fee";
  label: string;
  quantity: number;
  /** Unit price in pence for display math */
  unitAmountPence: number;
  /** Line total in pence */
  amountPence: number;
};

export type StarterPackQuote = {
  lineItems: MoneyLineItem[];
  monthlyTotalPence: number;
  setupFeePence: number;
  /** monthly + optional setup (first payment presentation) */
  dueNowPence: number;
};

function assertNonNegative(n: number, label: string): void {
  if (!Number.isFinite(n) || n < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

/** Convert GBP major units to integer pence (banker's-safe for 2dp money). */
export function gbpToPence(gbp: number): number {
  assertNonNegative(gbp, "GBP amount");
  return Math.round(gbp * 100);
}

export function penceToGbp(pence: number): number {
  return pence / 100;
}

export function isBillableRole(role: string): boolean {
  return ROLE_TO_LICENCE_CODE[role] != null;
}

export function licenceCodeForRole(role: string): BillableLicenceCode | null {
  return ROLE_TO_LICENCE_CODE[role] ?? null;
}

export function isBillableLicenceCode(
  code: string,
): code is BillableLicenceCode {
  return (BILLABLE_LICENCE_CODES as readonly string[]).includes(code);
}

/**
 * available = purchased − (used + pendingInvites)
 */
export function availableSeats(counts: SeatCounts): number {
  assertNonNegative(counts.purchased, "purchased");
  assertNonNegative(counts.used, "used");
  assertNonNegative(counts.pendingInvites, "pendingInvites");
  return Math.max(
    0,
    counts.purchased - (counts.used + counts.pendingInvites),
  );
}

export function canInviteWithoutPurchase(counts: SeatCounts): boolean {
  return availableSeats(counts) >= 1;
}

/**
 * Cannot reduce purchased seats below starter-pack minimum for that licence,
 * or below seats already committed (used + pending).
 */
export function minPurchasedSeatsAllowed(
  licenceCode: BillableLicenceCode,
  used: number,
  pendingInvites: number,
): number {
  const starterMin = STARTER_PACK_SEATS[licenceCode] ?? 0;
  const committed = Math.max(0, used) + Math.max(0, pendingInvites);
  return Math.max(starterMin, committed);
}

export function canReducePurchasedSeats(params: {
  licenceCode: BillableLicenceCode;
  currentPurchased: number;
  targetPurchased: number;
  used: number;
  pendingInvites: number;
}): boolean {
  const floor = minPurchasedSeatsAllowed(
    params.licenceCode,
    params.used,
    params.pendingInvites,
  );
  return (
    params.targetPurchased >= floor &&
    params.targetPurchased < params.currentPurchased
  );
}

/**
 * Days in the current billing cycle [periodStart, periodEnd] inclusive.
 */
export function daysInBillingCycle(
  periodStart: Date,
  periodEnd: Date,
): number {
  const start = utcDateOnly(periodStart);
  const end = utcDateOnly(periodEnd);
  if (end < start) {
    throw new Error("periodEnd must be on or after periodStart");
  }
  const ms = end.getTime() - start.getTime();
  return Math.floor(ms / 86_400_000) + 1;
}

/**
 * Remaining days from `asOf` through `periodEnd` inclusive.
 * If asOf is before periodStart, counts full cycle length.
 * If asOf is after periodEnd, returns 0.
 */
export function daysRemainingInCycle(
  periodStart: Date,
  periodEnd: Date,
  asOf: Date = new Date(),
): number {
  const start = utcDateOnly(periodStart);
  const end = utcDateOnly(periodEnd);
  const today = utcDateOnly(asOf);
  if (today > end) return 0;
  const from = today < start ? start : today;
  return daysInBillingCycle(from, end);
}

function utcDateOnly(d: Date): Date {
  return new Date(
    Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
  );
}

export function parseDateOnly(value: string): Date {
  const key = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) {
    throw new Error(`Invalid date-only value: ${value}`);
  }
  const [year, month, day] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

export function formatDateOnly(d: Date): string {
  return utcDateOnly(d).toISOString().slice(0, 10);
}

/** Next monthly anniversary, clamping to the last day of the target month. */
export function addCalendarMonthsUtc(periodStart: string, months: number): Date {
  const start = parseDateOnly(periodStart);
  const targetMonthIndex = start.getUTCMonth() + months;
  const year = start.getUTCFullYear() + Math.floor(targetMonthIndex / 12);
  const month = ((targetMonthIndex % 12) + 12) % 12;
  const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const day = Math.min(start.getUTCDate(), lastDay);
  return new Date(Date.UTC(year, month, day));
}

/** First cycle end = day before the next monthly anniversary (inclusive). */
export function periodEndFromAnchor(periodStart: string): string {
  const next = addCalendarMonthsUtc(periodStart, 1);
  next.setUTCDate(next.getUTCDate() - 1);
  return formatDateOnly(next);
}

/**
 * Pro-rata charge in pence for adding seats mid-cycle.
 * monthlyPriceGbp is the full monthly price for one seat (already resolved
 * first vs additional foster rate by the caller when needed).
 */
export function calculateProRataPence(params: {
  monthlyPriceGbp: number;
  periodStart: Date;
  periodEnd: Date;
  asOf?: Date;
  quantity?: number;
}): number {
  const quantity = params.quantity ?? 1;
  assertNonNegative(quantity, "quantity");
  if (quantity === 0) return 0;

  const daysTotal = daysInBillingCycle(params.periodStart, params.periodEnd);
  const daysLeft = daysRemainingInCycle(
    params.periodStart,
    params.periodEnd,
    params.asOf,
  );
  if (daysTotal <= 0 || daysLeft <= 0) return 0;

  const monthlyPence = gbpToPence(params.monthlyPriceGbp);
  const perSeat = Math.round((monthlyPence * daysLeft) / daysTotal);
  return perSeat * quantity;
}

/**
 * Optional setup / migration fee after percent discount (0–100).
 */
export function calculateSetupFeePence(params: {
  selected: boolean;
  amountGbp?: number;
  discountPercent?: number;
}): number {
  if (!params.selected) return 0;
  const amount = params.amountGbp ?? SETUP_FEE_DEFAULT_GBP;
  const discount = params.discountPercent ?? 0;
  assertNonNegative(amount, "setup fee amount");
  if (discount < 0 || discount > 100) {
    throw new Error("setup fee discountPercent must be between 0 and 100");
  }
  const pence = gbpToPence(amount);
  return Math.round(pence * (1 - discount / 100));
}

/**
 * Monthly pence for N seats of a non-foster licence (or foster when treating
 * all seats at a flat rate).
 */
export function flatSeatsMonthlyPence(
  priceMonthlyGbp: number,
  quantity: number,
): number {
  assertNonNegative(quantity, "quantity");
  return gbpToPence(priceMonthlyGbp) * quantity;
}

/**
 * Foster carer purchased-seat estimate for subscription / starter pack:
 * 1st seat at priceMonthly, remaining at priceAdditional (fallback monthly).
 */
export function fosterPurchasedSeatsMonthlyPence(params: {
  seats: number;
  priceMonthlyGbp: number;
  priceAdditionalGbp?: number | null;
}): number {
  const seats = params.seats;
  assertNonNegative(seats, "seats");
  if (seats === 0) return 0;

  const first = gbpToPence(params.priceMonthlyGbp);
  const additionalGbp =
    params.priceAdditionalGbp != null && params.priceAdditionalGbp >= 0
      ? params.priceAdditionalGbp
      : params.priceMonthlyGbp;
  const rest = gbpToPence(additionalGbp);

  if (seats === 1) return first;
  return first + rest * (seats - 1);
}

/**
 * Price for the next foster seat being purchased (the Nth seat where
 * N = currentPurchased + 1), for mid-cycle add confirm UI.
 */
export function nextFosterSeatMonthlyGbp(params: {
  currentPurchased: number;
  priceMonthlyGbp: number;
  priceAdditionalGbp?: number | null;
}): number {
  assertNonNegative(params.currentPurchased, "currentPurchased");
  if (params.currentPurchased <= 0) return params.priceMonthlyGbp;
  if (
    params.priceAdditionalGbp != null &&
    params.priceAdditionalGbp >= 0
  ) {
    return params.priceAdditionalGbp;
  }
  return params.priceMonthlyGbp;
}

function lineItemForLicence(
  code: BillableLicenceCode,
  quantity: number,
  price: LicencePrice,
): MoneyLineItem {
  let amountPence: number;
  let unitAmountPence: number;

  if (code === "foster_carer") {
    amountPence = fosterPurchasedSeatsMonthlyPence({
      seats: quantity,
      priceMonthlyGbp: price.priceMonthly,
      priceAdditionalGbp: price.priceAdditional,
    });
    unitAmountPence = quantity > 0 ? Math.round(amountPence / quantity) : 0;
  } else {
    unitAmountPence = gbpToPence(price.priceMonthly);
    amountPence = unitAmountPence * quantity;
  }

  return {
    code,
    label: LICENCE_LABELS[code],
    quantity,
    unitAmountPence,
    amountPence,
  };
}

/**
 * Build starter-pack quote from active licence prices.
 * Throws if a required starter licence price is missing.
 */
export function quoteStarterPack(params: {
  prices: LicencePrice[];
  setupFeeSelected?: boolean;
  setupFeeAmountGbp?: number;
  setupFeeDiscountPercent?: number;
}): StarterPackQuote {
  const byCode = new Map(params.prices.map((p) => [p.code, p]));
  const lineItems: MoneyLineItem[] = [];
  let monthlyTotalPence = 0;

  BILLABLE_LICENCE_CODES.forEach((code) => {
    const qty = STARTER_PACK_SEATS[code];
    const price = byCode.get(code);
    if (!price) {
      throw new Error(`Missing licence price for starter pack code: ${code}`);
    }

    const item = lineItemForLicence(code, qty, price);
    lineItems.push(item);
    monthlyTotalPence += item.amountPence;
  });

  const setupFeePence = calculateSetupFeePence({
    selected: params.setupFeeSelected ?? false,
    amountGbp: params.setupFeeAmountGbp,
    discountPercent: params.setupFeeDiscountPercent,
  });

  if (setupFeePence > 0) {
    lineItems.push({
      code: "setup_fee",
      label: "Setup / data migration (one-time)",
      quantity: 1,
      unitAmountPence: setupFeePence,
      amountPence: setupFeePence,
    });
  }

  return {
    lineItems,
    monthlyTotalPence,
    setupFeePence,
    dueNowPence: monthlyTotalPence + setupFeePence,
  };
}

/**
 * Monthly total from actually purchased seats (subscription amount).
 * Missing starter-pack codes default to starter-pack quantity.
 */
export function quotePurchasedSeats(params: {
  prices: LicencePrice[];
  seats: Partial<Record<BillableLicenceCode, number>>;
}): { lineItems: MoneyLineItem[]; monthlyTotalPence: number } {
  const byCode = new Map(params.prices.map((p) => [p.code, p]));
  const lineItems: MoneyLineItem[] = [];
  let monthlyTotalPence = 0;

  BILLABLE_LICENCE_CODES.forEach((code) => {
    const qty = params.seats[code] ?? STARTER_PACK_SEATS[code];
    const price = byCode.get(code);
    if (!price) {
      throw new Error(`Missing licence price for code: ${code}`);
    }
    const item = lineItemForLicence(code, qty, price);
    lineItems.push(item);
    monthlyTotalPence += item.amountPence;
  });

  return { lineItems, monthlyTotalPence };
}

/** Seed map for tenant_licences rows at agency create. */
export function starterPackTenantLicenceSeed(): Array<{
  licence_code: BillableLicenceCode;
  seats_purchased: number;
  seats_used: number;
}> {
  return BILLABLE_LICENCE_CODES.map((licence_code) => ({
    licence_code,
    seats_purchased: STARTER_PACK_SEATS[licence_code],
    seats_used: 0,
  }));
}
