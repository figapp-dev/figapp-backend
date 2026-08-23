import type { GoCardlessClient } from "gocardless-nodejs";
import type { Mandate, Payment, Subscription } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { quotePurchasedSeats } from "../../lib/billing-calculator.js";
import { invoiceHasSetupFee } from "../../lib/billing-periods.js";
import {
  GC_CURRENCY,
  GC_LICENCE_PAYMENT_NAME,
  GC_SUBSCRIPTION_NAME,
  createOrFindOnIdempotencyConflict,
  gcAmountToPence,
  penceToGcAmount,
} from "../../lib/gocardless.js";
import { purchasedSeatsByCode, toLicencePrices } from "../../mappers/billing.js";
import {
  findBillingCustomerByAgencyId,
  findInvoiceByGcPaymentId,
  insertInvoice,
  listActiveLicenceTypes,
  listInvoicesByAgency,
  listTenantLicences,
  updateInvoice,
} from "../../repositories/billing.js";
import type { AgencyBillingRow, MoneyLineItem } from "../../types/billing.js";

export function billingSubscriptionWrite(params: {
  agencyId: string;
  mandateId: string | null;
  subscription: Subscription;
  amountPence: number;
  statusFallback?: string;
  startDateFallback?: string | null;
  upcomingFallback?: string | null;
}) {
  const { subscription } = params;
  return {
    agency_id: params.agencyId,
    gocardless_subscription_id: subscription.id ?? "",
    gocardless_mandate_id: params.mandateId,
    amount_pence: gcAmountToPence(subscription.amount) || params.amountPence,
    currency: subscription.currency ?? GC_CURRENCY,
    interval_unit: subscription.interval_unit ?? "monthly",
    status: subscription.status ?? params.statusFallback ?? "pending",
    name: subscription.name ?? GC_SUBSCRIPTION_NAME,
    start_date: subscription.start_date ?? params.startDateFallback ?? null,
    upcoming_charge_date:
      subscription.upcoming_payments?.[0]?.charge_date ??
      params.upcomingFallback ??
      null,
  };
}

/** Monthly Direct Debit amount = currently purchased seats, not always the starter pack. */
export async function monthlySeatTotalPence(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ monthlyTotalPence: number; lineItems: MoneyLineItem[] }> {
  const [pricesRes, seatsRes] = await Promise.all([
    listActiveLicenceTypes(supabase),
    listTenantLicences(supabase, agencyId),
  ]);
  if (pricesRes.error) throw pricesRes.error;
  if (seatsRes.error) throw seatsRes.error;

  return quotePurchasedSeats({
    prices: toLicencePrices(pricesRes.data),
    seats: purchasedSeatsByCode(seatsRes.data),
  });
}

/**
 * One-off Direct Debit for the current seat total. FigApp owns the monthly
 * calendar; GoCardless only collects this payment against the saved mandate.
 */
export async function ensureSeatPayment(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  mandateId: string;
  periodStart: string;
  periodEnd: string;
  idempotencyKey: string;
}): Promise<Payment | null> {
  const { adminDb, gc, agency, mandateId } = params;
  const { monthlyTotalPence, lineItems } = await monthlySeatTotalPence(
    adminDb,
    agency.id,
  );
  if (monthlyTotalPence <= 0) {
    throw new Error("Monthly licence total must be greater than zero");
  }

  const payment = await createOrFindOnIdempotencyConflict(
    () =>
      gc.payments.create(
        {
          amount: penceToGcAmount(monthlyTotalPence),
          currency: GC_CURRENCY,
          description: GC_LICENCE_PAYMENT_NAME,
          retry_if_possible: true,
          links: { mandate: mandateId },
          metadata: {
            agency_id: agency.id,
            kind: "seats",
            period_start: params.periodStart,
          },
        },
        params.idempotencyKey,
      ),
    (id) => gc.payments.find(id),
  );

  const paymentId = payment.id;
  if (!paymentId) throw new Error("GoCardless licence payment missing id");

  await upsertInvoiceForPayment({
    adminDb,
    agencyId: agency.id,
    payment,
    status: "open",
    subscriptionId: null,
    lineItems,
    periodStart: params.periodStart,
    periodEnd: params.periodEnd,
  });

  return payment;
}

/**
 * Optional one-time £499 (after discount). Charged once against the mandate;
 * skipped if an invoice already has a setup_fee line.
 */
export async function ensureSetupFeePayment(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  mandateId: string;
  setupFeePence: number;
  lineItems: MoneyLineItem[];
}): Promise<Payment | null> {
  const { adminDb, gc, agency, mandateId, setupFeePence, lineItems } = params;
  if (setupFeePence <= 0) return null;

  const invoicesRes = await listInvoicesByAgency(adminDb, agency.id);
  if (invoicesRes.error) throw invoicesRes.error;
  if (invoicesRes.data.some((row) => invoiceHasSetupFee(row.line_items))) {
    return null;
  }

  const payment = await createOrFindOnIdempotencyConflict(
    () =>
      gc.payments.create(
        {
          amount: penceToGcAmount(setupFeePence),
          currency: GC_CURRENCY,
          description: "FigApp setup / data migration",
          retry_if_possible: true,
          links: { mandate: mandateId },
          metadata: { agency_id: agency.id, kind: "setup_fee" },
        },
        `setupfee:${agency.id}`,
      ),
    (id) => gc.payments.find(id),
  );

  const paymentId = payment.id;
  if (!paymentId) throw new Error("GoCardless setup-fee payment missing id");

  const existingInvoice = await findInvoiceByGcPaymentId(adminDb, paymentId);
  if (existingInvoice.error) throw existingInvoice.error;
  if (!existingInvoice.data) {
    const chargeDate = payment.charge_date ?? new Date().toISOString();
    const inserted = await insertInvoice(adminDb, {
      agency_id: agency.id,
      gocardless_payment_id: paymentId,
      gocardless_subscription_id: null,
      amount_total: gcAmountToPence(payment.amount) || setupFeePence,
      amount_paid: 0,
      currency: "gbp",
      status: "open",
      line_items: lineItems.filter((item) => item.code === "setup_fee"),
      period_start: chargeDate,
      period_end: chargeDate,
    });
    if (inserted.error) throw inserted.error;
  }

  return payment;
}

/** Mirror a GC payment onto invoices (unique on gocardless_payment_id). */
export async function upsertInvoiceForPayment(params: {
  adminDb: SupabaseClient;
  agencyId: string;
  payment: Payment;
  status: "open" | "paid" | "uncollectible";
  lineItems: MoneyLineItem[];
  subscriptionId?: string | null;
  periodStart?: string;
  periodEnd?: string;
}): Promise<void> {
  const paymentId = params.payment.id;
  if (!paymentId) return;

  const amount = gcAmountToPence(params.payment.amount);
  const chargeDate = params.payment.charge_date ?? new Date().toISOString();
  const periodStart = params.periodStart ?? chargeDate;
  const periodEnd = params.periodEnd ?? chargeDate;
  const existing = await findInvoiceByGcPaymentId(params.adminDb, paymentId);
  if (existing.error) throw existing.error;

  if (existing.data) {
    const { error } = await updateInvoice(params.adminDb, existing.data.id, {
      status: params.status,
      amount_total: amount || existing.data.amount_total,
      amount_paid: params.status === "paid" ? amount : existing.data.amount_paid,
      gocardless_subscription_id:
        params.subscriptionId ?? existing.data.gocardless_subscription_id,
      line_items:
        params.lineItems.length > 0
          ? params.lineItems
          : existing.data.line_items,
    });
    if (error) throw error;
    return;
  }

  const { error } = await insertInvoice(params.adminDb, {
    agency_id: params.agencyId,
    gocardless_payment_id: paymentId,
    gocardless_subscription_id: params.subscriptionId ?? null,
    amount_total: amount,
    amount_paid: params.status === "paid" ? amount : 0,
    currency: "gbp",
    status: params.status,
    line_items: params.lineItems,
    period_start: periodStart,
    period_end: periodEnd,
  });
  if (error) throw error;
}

export async function requireBillingCustomer(
  adminDb: SupabaseClient,
  agencyId: string,
) {
  const customer = await findBillingCustomerByAgencyId(adminDb, agencyId);
  if (customer.error) throw customer.error;
  if (!customer.data) {
    throw new Error(`No billing customer for agency ${agencyId}`);
  }
  return customer.data;
}

export async function bankHintFromMandate(
  gc: GoCardlessClient,
  mandate: Mandate,
): Promise<{ bankName: string | null; accountNumberEnding: string | null }> {
  const bankAccountId = mandate.links?.customer_bank_account;
  if (!bankAccountId) {
    return { bankName: null, accountNumberEnding: null };
  }
  try {
    const account = await gc.customerBankAccounts.find(bankAccountId);
    return {
      bankName: account.bank_name ?? null,
      accountNumberEnding: account.account_number_ending ?? null,
    };
  } catch {
    return { bankName: null, accountNumberEnding: null };
  }
}
