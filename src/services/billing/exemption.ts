import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { findAgencyBillingById, updateAgencyBilling } from "../../repositories/billing.js";
import type { AgencyBillingStatus } from "../../types/billing.js";
import { getBillingCaller } from "./authz.js";

export type BillingExemptionBody = {
  billingExempt: boolean;
  setupFeeSelected?: boolean;
  setupFeeAmountGbp?: number;
  setupFeeDiscountPercent?: number;
};

export type BillingExemptionDto = {
  agencyId: string;
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  setupFeeSelected: boolean;
  setupFeeAmountGbp: number;
  setupFeeDiscountPercent: number;
};

/**
 * Superadmin / app admin only. Sets billing_exempt + billing_status together.
 * Does not touch cycle dates, past_due, or GoCardless resource tables.
 */
export async function updateAgencyBillingExemption(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
  body: BillingExemptionBody,
) {
  const caller = await getBillingCaller(supabase, userId);
  if (!caller.data) return caller;
  if (!caller.data.isPlatformAdmin) {
    return serviceFailure({ forbidden: true });
  }

  const agencyRes = await findAgencyBillingById(supabase, agencyId);
  if (agencyRes.error) {
    return serviceFailure({ error: agencyRes.error });
  }
  if (!agencyRes.data) {
    return serviceFailure({ notFound: true });
  }

  const billingExempt = body.billingExempt;
  const setupFeeSelected = billingExempt
    ? false
    : body.setupFeeSelected === true;
  const setupFeeAmountGbp = Number.isFinite(body.setupFeeAmountGbp)
    ? Math.max(0, Number(body.setupFeeAmountGbp))
    : 499;
  let discount = Number.isFinite(body.setupFeeDiscountPercent)
    ? Number(body.setupFeeDiscountPercent)
    : 0;
  if (discount < 0 || discount > 100) {
    return serviceFailure({ badRequest: true });
  }
  if (!setupFeeSelected) discount = 0;

  const billingStatus: AgencyBillingStatus = billingExempt
    ? "billing_exempt"
    : agencyRes.data.billing_exempt ||
        agencyRes.data.billing_status === "billing_exempt" ||
        agencyRes.data.billing_status === "pending_setup"
      ? "pending_setup"
      : agencyRes.data.billing_status;

  let adminDb: SupabaseClient;
  try {
    adminDb = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({
      error: error instanceof Error ? error : new Error(String(error)),
    });
  }

  const update = await updateAgencyBilling(adminDb, agencyId, {
    billing_exempt: billingExempt,
    billing_status: billingStatus,
    setup_fee_selected: setupFeeSelected,
    setup_fee_amount_gbp: setupFeeAmountGbp,
    setup_fee_discount_percent: discount,
  });

  if (update.error) {
    return serviceFailure({ error: update.error });
  }

  return serviceSuccess<BillingExemptionDto>({
    agencyId,
    billingExempt,
    billingStatus,
    setupFeeSelected,
    setupFeeAmountGbp,
    setupFeeDiscountPercent: discount,
  });
}
