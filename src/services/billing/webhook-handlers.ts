import type { Event } from "gocardless-nodejs";
import { parse as parseGoCardlessWebhook } from "gocardless-nodejs";
import type { GoCardlessClient } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import { gocardlessEventType } from "../../lib/billing-access.js";
import {
  agencyIdFromGcMetadata,
  gocardlessEventResourceId,
} from "../../lib/gocardless-webhook.js";
import { env } from "../../config/env.js";
import { GC_PROVIDER, getGoCardlessClient } from "../../lib/gocardless.js";
import { toError } from "../../lib/errors.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  findAgencyBillingById,
  findBillingCustomerByGcId,
  findPaymentMethodByMandateId,
  findSubscriptionByGcId,
  insertBillingEvent,
  markBillingEventProcessed,
} from "../../repositories/billing.js";
import type { BillingEventRow } from "../../types/billing.js";
import {
  handleBillingRequestEvent,
  handleMandateEvent,
} from "./mandate.js";
import { handlePaymentEvent, handleSubscriptionEvent } from "./payments.js";

export type ProcessWebhookResult =
  | { ok: true }
  | { invalidSignature: true }
  | { misconfigured: true; error: Error }
  | { invalidBody: true }
  | { processingFailed: true; error: Error };

function isInvalidSignature(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  return (error as { name?: string }).name === "InvalidSignatureError";
}

/**
 * Resolve FigApp agency from GC metadata first, then our billing tables,
 * then linked GC resources. Webhooks often arrive before our rows exist.
 */
async function resolveAgencyId(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  event: Event;
}): Promise<string | null> {
  const { adminDb, gc, event } = params;
  const fromMeta =
    agencyIdFromGcMetadata(event.metadata) ??
    agencyIdFromGcMetadata(event.resource_metadata);
  if (fromMeta) return fromMeta;

  const links = event.links;
  if (links?.mandate) {
    const method = await findPaymentMethodByMandateId(adminDb, links.mandate);
    if (method.data) return method.data.agency_id;
  }
  if (links?.subscription) {
    const sub = await findSubscriptionByGcId(adminDb, links.subscription);
    if (sub.data) return sub.data.agency_id;
  }
  if (links?.customer) {
    const customer = await findBillingCustomerByGcId(adminDb, links.customer);
    if (customer.data) return customer.data.agency_id;
  }
  if (links?.billing_request) {
    const br = await gc.billingRequests.find(links.billing_request);
    const fromBr = agencyIdFromGcMetadata(br.metadata);
    if (fromBr) return fromBr;
    if (br.links?.customer) {
      const customer = await findBillingCustomerByGcId(adminDb, br.links.customer);
      if (customer.data) return customer.data.agency_id;
    }
  }
  if (links?.payment) {
    const payment = await gc.payments.find(links.payment);
    const fromPayment = agencyIdFromGcMetadata(payment.metadata);
    if (fromPayment) return fromPayment;
    if (payment.links?.mandate) {
      const method = await findPaymentMethodByMandateId(
        adminDb,
        payment.links.mandate,
      );
      if (method.data) return method.data.agency_id;
    }
  }
  if (links?.mandate) {
    const mandate = await gc.mandates.find(links.mandate);
    if (mandate.links?.customer) {
      const customer = await findBillingCustomerByGcId(
        adminDb,
        mandate.links.customer,
      );
      if (customer.data) return customer.data.agency_id;
      const gcCustomer = await gc.customers.find(mandate.links.customer);
      return agencyIdFromGcMetadata(gcCustomer.metadata);
    }
  }

  return null;
}

async function processEvent(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  event: Event;
  stored: BillingEventRow;
}): Promise<void> {
  const agencyId =
    params.stored.agency_id ??
    (await resolveAgencyId({
      adminDb: params.adminDb,
      gc: params.gc,
      event: params.event,
    }));

  if (!agencyId) {
    await markBillingEventProcessed(params.adminDb, params.stored.id, {
      processed_at: new Date().toISOString(),
      processing_error: "agency_not_resolved",
    });
    return;
  }

  const agencyRes = await findAgencyBillingById(params.adminDb, agencyId);
  if (agencyRes.error) throw agencyRes.error;
  if (!agencyRes.data) {
    await markBillingEventProcessed(params.adminDb, params.stored.id, {
      agency_id: agencyId,
      processed_at: new Date().toISOString(),
      processing_error: "agency_not_found",
    });
    return;
  }

  const handlerParams = {
    adminDb: params.adminDb,
    gc: params.gc,
    agency: agencyRes.data,
    event: params.event,
  };

  switch (params.event.resource_type) {
    case "mandates":
      await handleMandateEvent(handlerParams);
      break;
    case "billing_requests":
      await handleBillingRequestEvent(handlerParams);
      break;
    case "payments":
      await handlePaymentEvent(handlerParams);
      break;
    case "subscriptions":
      await handleSubscriptionEvent(handlerParams);
      break;
    default:
      break;
  }

  const { error } = await markBillingEventProcessed(params.adminDb, params.stored.id, {
    agency_id: agencyId,
    processed_at: new Date().toISOString(),
    processing_error: null,
  });
  if (error) throw error;
}

/**
 * Verify signature, persist each event_id (unique), then process.
 * Already-processed rows are skipped so GC retries stay idempotent.
 * Processing failure returns 500 so GoCardless retries.
 */
export async function processGoCardlessWebhook(
  rawBody: string,
  signatureHeader: string | undefined,
): Promise<ProcessWebhookResult> {
  if (!env.gocardlessWebhookSecret || !env.supabaseServiceRoleKey) {
    return {
      misconfigured: true,
      error: new Error("GoCardless webhook or service-role secrets are not configured"),
    };
  }
  if (!signatureHeader) {
    return { invalidSignature: true };
  }
  if (!rawBody?.trim()) {
    return { invalidBody: true };
  }

  let events: Event[];
  try {
    events = parseGoCardlessWebhook(
      rawBody,
      env.gocardlessWebhookSecret,
      signatureHeader,
    );
  } catch (error) {
    if (isInvalidSignature(error)) {
      return { invalidSignature: true };
    }
    return { invalidBody: true };
  }

  if (!Array.isArray(events)) {
    return { invalidBody: true };
  }

  let adminDb: SupabaseClient;
  let gc: GoCardlessClient;
  try {
    adminDb = createServiceRoleClient();
    gc = getGoCardlessClient();
  } catch (error) {
    return { misconfigured: true, error: toError(error) };
  }

  try {
    for (const event of events) {
      if (!event.id) continue;

      const inserted = await insertBillingEvent(adminDb, {
        agency_id:
          agencyIdFromGcMetadata(event.metadata) ??
          agencyIdFromGcMetadata(event.resource_metadata),
        provider: GC_PROVIDER,
        event_id: event.id,
        event_type: gocardlessEventType(event.resource_type, event.action),
        resource_type: event.resource_type ?? null,
        resource_id: gocardlessEventResourceId(event),
        payload: event,
      });
      if (inserted.error || !inserted.data) {
        throw inserted.error ?? new Error("Failed to persist billing event");
      }
      if (inserted.data.processed_at) continue;

      await processEvent({
        adminDb,
        gc,
        event,
        stored: inserted.data,
      });
    }

    return { ok: true };
  } catch (error) {
    return { processingFailed: true, error: toError(error) };
  }
}
