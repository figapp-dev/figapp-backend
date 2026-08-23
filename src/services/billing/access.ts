import type { SupabaseClient } from "@supabase/supabase-js";
import { billingAccessFromAgency } from "../../lib/billing-access.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { toBillingAccessDto } from "../../mappers/billing.js";
import { findAgencyBillingById } from "../../repositories/billing.js";
import type { BillingAccessDto } from "../../types/billing.js";
import { getBillingCaller } from "./authz.js";

export type BillingAccessResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<typeof serviceSuccess<BillingAccessDto>>);

/**
 * Mobile/web gate. Uses the caller's own agency (from JWT), never a body agencyId.
 * Platform admins without an agency are always allowed through.
 */
export async function getBillingAccess(
  supabase: SupabaseClient,
  userId: string,
): Promise<BillingAccessResult> {
  const caller = await getBillingCaller(supabase, userId);
  if (!caller.data) return caller;

  const agencyId = caller.data.agencyUser?.agency_id ?? null;

  if (!agencyId) {
    if (caller.data.isPlatformAdmin) {
      return serviceSuccess(
        toBillingAccessDto({
          agencyId: null,
          billingExempt: true,
          billingStatus: "billing_exempt",
          canUseApp: true,
          needsPaymentSetup: false,
        }),
      );
    }

    return serviceSuccess(
      toBillingAccessDto({
        agencyId: null,
        billingExempt: false,
        billingStatus: "pending_setup",
        canUseApp: false,
        needsPaymentSetup: false,
      }),
    );
  }

  const agencyRes = await findAgencyBillingById(supabase, agencyId);
  if (agencyRes.error) {
    return serviceFailure({ error: agencyRes.error });
  }
  if (!agencyRes.data) {
    return serviceFailure({ notFound: true });
  }

  const flags = billingAccessFromAgency({
    billingExempt: agencyRes.data.billing_exempt,
    billingStatus: agencyRes.data.billing_status,
  });

  return serviceSuccess(
    toBillingAccessDto({
      agencyId: agencyRes.data.id,
      billingExempt: agencyRes.data.billing_exempt,
      billingStatus: agencyRes.data.billing_status,
      canUseApp: flags.canUseApp,
      needsPaymentSetup: flags.needsPaymentSetup,
    }),
  );
}
