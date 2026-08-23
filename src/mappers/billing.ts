import {
  isBillableLicenceCode,
  type LicencePrice,
} from "../lib/billing-calculator.js";
import { isUsableMandateStatus } from "../lib/billing-access.js";
import { coerceNumber } from "../lib/numbers.js";
import type {
  AgencyBillingRow,
  AgencyBillingStatus,
  BillingAccessDto,
  BillingPaymentMethodRow,
  BillingSummaryDto,
  LicenceTypeRow,
  MoneyLineItem,
  TenantLicenceRow,
} from "../types/billing.js";

export function toLicencePrices(rows: LicenceTypeRow[]): LicencePrice[] {
  const prices: LicencePrice[] = [];
  for (const row of rows) {
    if (row.is_active === false) continue;
    if (!isBillableLicenceCode(row.code)) continue;
    prices.push({
      code: row.code,
      priceMonthly: coerceNumber(row.price_monthly),
      priceAdditional:
        row.price_additional == null
          ? null
          : coerceNumber(row.price_additional),
    });
  }
  return prices;
}

export function purchasedSeatsByCode(
  rows: TenantLicenceRow[],
): Partial<Record<LicencePrice["code"], number>> {
  const seats: Partial<Record<LicencePrice["code"], number>> = {};
  for (const row of rows) {
    if (!isBillableLicenceCode(row.licence_code)) continue;
    seats[row.licence_code] = row.seats_purchased ?? 0;
  }
  return seats;
}

export function defaultMandateStatus(
  methods: BillingPaymentMethodRow[],
): string | null {
  const usable = methods.find((row) => isUsableMandateStatus(row.status));
  if (usable) return usable.status;
  return methods[0]?.status ?? null;
}

export function toBillingAccessDto(params: {
  agencyId: string | null;
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  canUseApp: boolean;
  needsPaymentSetup: boolean;
}): BillingAccessDto {
  return {
    agencyId: params.agencyId,
    billingExempt: params.billingExempt,
    billingStatus: params.billingStatus,
    canUseApp: params.canUseApp,
    needsPaymentSetup: params.needsPaymentSetup,
  };
}

export function toBillingSummaryDto(params: {
  agency: AgencyBillingRow;
  mandateExists: boolean;
  mandateStatus: string | null;
  lineItems: MoneyLineItem[];
  monthlyTotalPence: number;
  setupFeePence: number;
  dueNowPence: number;
}): BillingSummaryDto {
  return {
    agencyId: params.agency.id,
    agencyName: params.agency.name,
    billingExempt: params.agency.billing_exempt,
    billingStatus: params.agency.billing_status,
    mandateExists: params.mandateExists,
    mandateStatus: params.mandateStatus,
    setupFeeSelected: params.agency.setup_fee_selected,
    lineItems: params.lineItems,
    monthlyTotalPence: params.monthlyTotalPence,
    setupFeePence: params.setupFeePence,
    dueNowPence: params.dueNowPence,
    billingCycleAnchor: params.agency.billing_cycle_anchor,
    currentPeriodStart: params.agency.current_period_start,
    currentPeriodEnd: params.agency.current_period_end,
  };
}

export {
  invoiceHasSetupFee,
  isSeatLicenceInvoice,
} from "../lib/billing-periods.js";
