import { quoteStarterPack, type StarterPackQuote } from "../../lib/billing-calculator.js";
import { coerceNumber } from "../../lib/numbers.js";
import { toLicencePrices } from "../../mappers/billing.js";
import type { AgencyBillingRow, LicenceTypeRow } from "../../types/billing.js";

/** Payment-screen quote: starter-pack seats × catalogue prices + optional £499. */
export function quoteAgencyStarterPack(
  agency: AgencyBillingRow,
  licenceRows: LicenceTypeRow[],
): StarterPackQuote {
  return quoteStarterPack({
    prices: toLicencePrices(licenceRows),
    setupFeeSelected: agency.setup_fee_selected,
    setupFeeAmountGbp: coerceNumber(agency.setup_fee_amount_gbp),
    setupFeeDiscountPercent: coerceNumber(agency.setup_fee_discount_percent),
  });
}

export function agencyBillingEmail(agency: AgencyBillingRow): string | null {
  return agency.billing_email?.trim() || agency.contact_email.trim() || null;
}
