import type { Mandate } from "gocardless-nodejs";
import type { GoCardlessClient } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isMandateTerminalAction,
  isMandateUsableAction,
  isUsableMandateStatus,
} from "../../lib/billing-access.js";
import {
  FIRST_SEAT_PERIOD_KEY,
  hasAnySeatInvoice,
  seatPaymentIdempotencyKey,
} from "../../lib/billing-periods.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import { periodEndFromAnchor } from "../../lib/billing-calculator.js";
import { GC_SCHEME } from "../../lib/gocardless.js";
import {
  listActiveLicenceTypes,
  listInvoicesByAgency,
  updateAgencyBilling,
  upsertBillingCustomer,
  upsertPaymentMethod,
} from "../../repositories/billing.js";
import type { AgencyBillingRow } from "../../types/billing.js";
import { quoteAgencyStarterPack } from "./quotes.js";
import {
  bankHintFromMandate,
  ensureSeatPayment,
  ensureSetupFeePayment,
  requireBillingCustomer,
} from "./subscription.js";
import type { GcWebhookHandlerParams } from "./webhook-context.js";

async function persistCustomerFromMandate(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agencyId: string;
  mandate: Mandate;
}): Promise<string> {
  const customerId = params.mandate.links?.customer;
  if (!customerId) {
    const existing = await requireBillingCustomer(params.adminDb, params.agencyId);
    return existing.id;
  }

  const gcCustomer = await params.gc.customers.find(customerId);
  const upserted = await upsertBillingCustomer(params.adminDb, {
    agency_id: params.agencyId,
    gocardless_customer_id: customerId,
    billing_email: gcCustomer.email ?? null,
  });
  if (upserted.error || !upserted.data) {
    throw upserted.error ?? new Error("Failed to upsert billing customer");
  }
  return upserted.data.id;
}

/**
 * Mandate usable → unlock the agency (status active) even if the first DD
 * is still pending. Cycle anniversary is NOT set here; that waits for first paid payment.
 */
export async function activateMandate(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  mandate: Mandate;
}): Promise<void> {
  const mandateId = params.mandate.id;
  if (!mandateId) throw new Error("Mandate missing id");

  const billingCustomerId = await persistCustomerFromMandate({
    adminDb: params.adminDb,
    gc: params.gc,
    agencyId: params.agency.id,
    mandate: params.mandate,
  });
  const hint = await bankHintFromMandate(params.gc, params.mandate);

  const method = await upsertPaymentMethod(params.adminDb, {
    agency_id: params.agency.id,
    billing_customer_id: billingCustomerId,
    gocardless_mandate_id: mandateId,
    status: params.mandate.status ?? "pending",
    scheme: params.mandate.scheme ?? GC_SCHEME,
    bank_name: hint.bankName,
    account_number_ending: hint.accountNumberEnding,
    is_default: true,
  });
  if (method.error) throw method.error;

  if (
    isUsableMandateStatus(params.mandate.status) &&
    params.agency.billing_status === "pending_setup"
  ) {
    const { error } = await updateAgencyBilling(params.adminDb, params.agency.id, {
      billing_status: "active",
    });
    if (error) throw error;
    params.agency.billing_status = "active";
  }

  if (!isUsableMandateStatus(params.mandate.status)) return;

  const invoicesRes = await listInvoicesByAgency(params.adminDb, params.agency.id);
  if (invoicesRes.error) throw invoicesRes.error;

  if (!hasAnySeatInvoice(invoicesRes.data)) {
    const today = getTodayUKDateString();
    const firstPeriodStart =
      params.agency.billing_cycle_anchor?.slice(0, 10) ?? today;
    await ensureSeatPayment({
      adminDb: params.adminDb,
      gc: params.gc,
      agency: params.agency,
      mandateId,
      periodStart: firstPeriodStart,
      periodEnd: periodEndFromAnchor(firstPeriodStart),
      idempotencyKey: seatPaymentIdempotencyKey(
        params.agency.id,
        FIRST_SEAT_PERIOD_KEY,
      ),
    });
  }

  const prices = await listActiveLicenceTypes(params.adminDb);
  if (prices.error) throw prices.error;
  const quote = quoteAgencyStarterPack(params.agency, prices.data);

  await ensureSetupFeePayment({
    adminDb: params.adminDb,
    gc: params.gc,
    agency: params.agency,
    mandateId,
    setupFeePence: quote.setupFeePence,
    lineItems: quote.lineItems,
  });
}

export async function handleMandateEvent(
  params: GcWebhookHandlerParams,
): Promise<void> {
  const mandateId = params.event.links?.mandate;
  if (!mandateId) return;
  const mandate = await params.gc.mandates.find(mandateId);

  if (
    isMandateUsableAction(params.event.action) ||
    isUsableMandateStatus(mandate.status)
  ) {
    await activateMandate({
      adminDb: params.adminDb,
      gc: params.gc,
      agency: params.agency,
      mandate,
    });
    return;
  }

  if (isMandateTerminalAction(params.event.action)) {
    const customer = await persistCustomerFromMandate({
      adminDb: params.adminDb,
      gc: params.gc,
      agencyId: params.agency.id,
      mandate,
    });
    const { error } = await upsertPaymentMethod(params.adminDb, {
      agency_id: params.agency.id,
      billing_customer_id: customer,
      gocardless_mandate_id: mandateId,
      status: mandate.status ?? params.event.action ?? "cancelled",
      scheme: mandate.scheme ?? GC_SCHEME,
      bank_name: null,
      account_number_ending: null,
      is_default: false,
    });
    if (error) throw error;
  }
}

/** Hosted Billing Request completed → same mandate follow-up as mandate webhooks. */
export async function handleBillingRequestEvent(
  params: GcWebhookHandlerParams,
): Promise<void> {
  if (params.event.action !== "fulfilled" && params.event.action !== "confirmed") {
    return;
  }
  const billingRequestId = params.event.links?.billing_request;
  if (!billingRequestId) return;

  const br = await params.gc.billingRequests.find(billingRequestId);
  const mandateId =
    br.links?.mandate_request_mandate ?? params.event.links?.mandate_request_mandate;
  if (!mandateId) return;

  const mandate = await params.gc.mandates.find(mandateId);
  await activateMandate({
    adminDb: params.adminDb,
    gc: params.gc,
    agency: params.agency,
    mandate,
  });
}
