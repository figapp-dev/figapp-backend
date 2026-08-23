import type { SupabaseClient } from "@supabase/supabase-js";
import { isUsableMandateStatus } from "../../lib/billing-access.js";
import { toError } from "../../lib/errors.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import {
  defaultMandateStatus,
  toBillingSummaryDto,
} from "../../mappers/billing.js";
import {
  listActiveLicenceTypes,
  listPaymentMethods,
} from "../../repositories/billing.js";
import type { BillingSummaryDto } from "../../types/billing.js";
import { loadManagedAgency } from "./authz.js";
import { quoteAgencyStarterPack } from "./quotes.js";

export type BillingSummaryResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<typeof serviceSuccess<BillingSummaryDto>>);

/** Payment screen: starter-pack lines + optional setup fee, not mid-cycle seat adds. */
export async function getBillingSummary(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<BillingSummaryResult> {
  const loaded = await loadManagedAgency(supabase, userId, agencyId);
  if (!loaded.data) return loaded;

  const [pricesRes, methodsRes] = await Promise.all([
    listActiveLicenceTypes(supabase),
    listPaymentMethods(supabase, agencyId),
  ]);

  if (pricesRes.error) {
    return serviceFailure({ error: pricesRes.error });
  }
  if (methodsRes.error) {
    return serviceFailure({ error: methodsRes.error });
  }

  let quote;
  try {
    quote = quoteAgencyStarterPack(loaded.data.agency, pricesRes.data);
  } catch (error) {
    return serviceFailure({
      error: toError(error),
      badRequest: true,
    });
  }

  const mandateStatus = defaultMandateStatus(methodsRes.data);

  return serviceSuccess(
    toBillingSummaryDto({
      agency: loaded.data.agency,
      mandateExists: isUsableMandateStatus(mandateStatus),
      mandateStatus,
      lineItems: quote.lineItems,
      monthlyTotalPence: quote.monthlyTotalPence,
      setupFeePence: quote.setupFeePence,
      dueNowPence: quote.dueNowPence,
    }),
  );
}
