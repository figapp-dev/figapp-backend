import type { GoCardlessClient } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUsableMandateStatus } from "../../lib/billing-access.js";
import {
  FIRST_SEAT_PERIOD_KEY,
  periodsNeedingPayment,
  seatPaymentIdempotencyKey,
} from "../../lib/billing-periods.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import { toError } from "../../lib/errors.js";
import { getGoCardlessClient } from "../../lib/gocardless.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { env } from "../../config/env.js";
import {
  listAgenciesForLicenceCollection,
  listInvoicesByAgency,
  listPaymentMethods,
  updateAgencyBilling,
} from "../../repositories/billing.js";
import type { AgencyBillingRow } from "../../types/billing.js";
import { runPastDueDunning } from "./dunning.js";
import { applyDueSeatReductions } from "./seat-reductions.js";
import { ensureSeatPayment } from "./subscription.js";

export type LicenceCollectResult = {
  agenciesConsidered: number;
  paymentsCreated: number;
  skipped: number;
  noticesSent: number;
  agenciesSuspended: number;
  reductionsApplied: number;
  errors: Array<{ agencyId: string; message: string }>;
};

function defaultUsableMandateId(
  methods: Array<{ gocardless_mandate_id: string; status: string; is_default: boolean }>,
): string | null {
  const usable = methods.filter((row) => isUsableMandateStatus(row.status));
  const preferred = usable.find((row) => row.is_default) ?? usable[0];
  return preferred?.gocardless_mandate_id ?? null;
}

async function collectForAgency(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  today: string;
}): Promise<number> {
  const { adminDb, gc, agency, today } = params;
  const methods = await listPaymentMethods(adminDb, agency.id);
  if (methods.error) throw methods.error;
  const mandateId = defaultUsableMandateId(methods.data);
  if (!mandateId) return 0;

  const invoices = await listInvoicesByAgency(adminDb, agency.id);
  if (invoices.error) throw invoices.error;

  const due = periodsNeedingPayment({
    billingCycleAnchor: agency.billing_cycle_anchor,
    today,
    invoices: invoices.data,
  });
  if (due.length === 0) return 0;

  let created = 0;
  for (const period of due) {
    await ensureSeatPayment({
      adminDb,
      gc,
      agency,
      mandateId,
      periodStart: period.start,
      periodEnd: period.end,
      idempotencyKey: seatPaymentIdempotencyKey(agency.id, period.key),
    });
    created += 1;

    if (period.key !== FIRST_SEAT_PERIOD_KEY && agency.billing_cycle_anchor) {
      const { error } = await updateAgencyBilling(adminDb, agency.id, {
        current_period_start: period.start,
        current_period_end: period.end,
      });
      if (error) throw error;
      agency.current_period_start = period.start;
      agency.current_period_end = period.end;
    }
  }
  return created;
}

/**
 * Daily catch-up: create missing licence one-offs for commercial agencies.
 * Idempotent per agency+period via GoCardless keys and existing invoices.
 */
export async function collectDueLicencePayments(
  today: string = getTodayUKDateString(),
): Promise<LicenceCollectResult> {
  if (!env.gocardlessAccessToken || !env.supabaseServiceRoleKey) {
    throw new Error("GoCardless or service-role secrets are not configured");
  }

  const adminDb = createServiceRoleClient();
  const gc = getGoCardlessClient();
  const agenciesRes = await listAgenciesForLicenceCollection(adminDb);
  if (agenciesRes.error) throw agenciesRes.error;

  const result: LicenceCollectResult = {
    agenciesConsidered: agenciesRes.data.length,
    paymentsCreated: 0,
    skipped: 0,
    noticesSent: 0,
    agenciesSuspended: 0,
    reductionsApplied: 0,
    errors: [],
  };

  try {
    const reductions = await applyDueSeatReductions(adminDb, today);
    result.reductionsApplied = reductions.applied;
    result.errors.push(...reductions.errors);
  } catch (error) {
    result.errors.push({
      agencyId: "seat-reductions",
      message: toError(error).message,
    });
  }

  for (const agency of agenciesRes.data) {
    try {
      const created = await collectForAgency({ adminDb, gc, agency, today });
      result.paymentsCreated += created;
      if (created === 0) result.skipped += 1;
    } catch (error) {
      result.errors.push({ agencyId: agency.id, message: toError(error).message });
    }
  }

  try {
    const dunning = await runPastDueDunning(adminDb, today);
    result.noticesSent = dunning.noticesSent;
    result.agenciesSuspended = dunning.agenciesSuspended;
    result.errors.push(...dunning.errors);
  } catch (error) {
    result.errors.push({
      agencyId: "dunning",
      message: toError(error).message,
    });
  }

  return result;
}
