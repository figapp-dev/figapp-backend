import type { Payment } from "gocardless-nodejs";
import { calculateSetupFeePence, periodEndFromAnchor } from "../../lib/billing-calculator.js";
import { isPaymentFailureAction, isPaymentSuccessAction } from "../../lib/billing-access.js";
import { coerceNumber } from "../../lib/numbers.js";
import {
  updateAgencyBilling,
  upsertBillingSubscription,
} from "../../repositories/billing.js";
import {
  billingSubscriptionWrite,
  upsertInvoiceForPayment,
} from "./subscription.js";
import type { GcWebhookHandlerParams } from "./webhook-context.js";

/**
 * First successful payment (setup fee or seats) sets the monthly anniversary.
 * Failed collection starts the 28-day grace (`past_due`); suspend is a later cron.
 */
export async function handlePaymentEvent(
  params: GcWebhookHandlerParams,
): Promise<void> {
  const paymentId = params.event.links?.payment;
  if (!paymentId) return;
  const payment: Payment = await params.gc.payments.find(paymentId);
  const kind = payment.metadata?.kind;
  const subscriptionId =
    payment.links?.subscription ?? params.event.links?.subscription ?? null;

  if (isPaymentSuccessAction(params.event.action)) {
    const chargeDate =
      payment.charge_date ?? new Date().toISOString().slice(0, 10);
    const patch: Record<string, unknown> = {
      billing_status: "active",
      past_due_since: null,
      suspended_at: null,
    };
    if (!params.agency.billing_cycle_anchor) {
      patch.billing_cycle_anchor = chargeDate.slice(0, 10);
      patch.current_period_start = chargeDate.slice(0, 10);
      patch.current_period_end = periodEndFromAnchor(chargeDate.slice(0, 10));
    }
    const { error } = await updateAgencyBilling(
      params.adminDb,
      params.agency.id,
      patch,
    );
    if (error) throw error;

    const setupFeePence = calculateSetupFeePence({
      selected: true,
      amountGbp: coerceNumber(params.agency.setup_fee_amount_gbp),
      discountPercent: coerceNumber(params.agency.setup_fee_discount_percent),
    });

    await upsertInvoiceForPayment({
      adminDb: params.adminDb,
      agencyId: params.agency.id,
      payment,
      status: "paid",
      subscriptionId,
      lineItems:
        kind === "setup_fee"
          ? [
              {
                code: "setup_fee",
                label: "Setup / data migration (one-time)",
                quantity: 1,
                unitAmountPence: setupFeePence,
                amountPence: setupFeePence,
              },
            ]
          : [],
    });
    return;
  }

  if (params.event.action === "created") {
    await upsertInvoiceForPayment({
      adminDb: params.adminDb,
      agencyId: params.agency.id,
      payment,
      status: "open",
      subscriptionId,
      lineItems: [],
    });
    return;
  }

  if (isPaymentFailureAction(params.event.action)) {
    const today = new Date().toISOString().slice(0, 10);
    const { error } = await updateAgencyBilling(params.adminDb, params.agency.id, {
      billing_status: "past_due",
      past_due_since: params.agency.past_due_since ?? today,
    });
    if (error) throw error;

    await upsertInvoiceForPayment({
      adminDb: params.adminDb,
      agencyId: params.agency.id,
      payment,
      status: "uncollectible",
      subscriptionId,
      lineItems: [],
    });
  }
}

export async function handleSubscriptionEvent(
  params: GcWebhookHandlerParams,
): Promise<void> {
  const subscriptionId = params.event.links?.subscription;
  if (!subscriptionId) return;
  const subscription = await params.gc.subscriptions.find(subscriptionId);

  const { error } = await upsertBillingSubscription(
    params.adminDb,
    billingSubscriptionWrite({
      agencyId: params.agency.id,
      mandateId: subscription.links?.mandate ?? params.event.links?.mandate ?? null,
      subscription,
      amountPence: Number(subscription.amount ?? 0),
      statusFallback: params.event.action ?? "pending",
    }),
  );
  if (error) throw error;
}
