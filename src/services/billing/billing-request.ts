import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isUsableMandateStatus } from "../../lib/billing-access.js";
import { toError } from "../../lib/errors.js";
import {
  GC_PROVIDER,
  GC_SCHEME,
  createOrFindOnIdempotencyConflict,
  getGoCardlessClient,
} from "../../lib/gocardless.js";
import { isAllowedRedirectUrl } from "../../lib/redirect-urls.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  findBillingCustomerByAgencyId,
  insertBillingEvent,
  listPaymentMethods,
  upsertBillingCustomer,
} from "../../repositories/billing.js";
import type {
  CreateBillingRequestBody,
  CreateBillingRequestDto,
} from "../../types/billing.js";
import { loadManagedAgency } from "./authz.js";
import { agencyBillingEmail } from "./quotes.js";

export type CreateBillingRequestResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<typeof serviceSuccess<CreateBillingRequestDto>>);

/**
 * Start GoCardless hosted Direct Debit. Does not unlock the app; webhooks
 * activate the mandate. Service-role writes only after primary-admin authz.
 */
export async function createAgencyBillingRequest(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
  body: CreateBillingRequestBody,
): Promise<CreateBillingRequestResult> {
  if (!isAllowedRedirectUrl(body.successRedirectUrl)) {
    return serviceFailure({ badRequest: true });
  }
  const exitUrl = body.exitRedirectUrl?.trim() || body.successRedirectUrl;
  if (!isAllowedRedirectUrl(exitUrl)) {
    return serviceFailure({ badRequest: true });
  }

  const loaded = await loadManagedAgency(supabase, userId, agencyId);
  if (!loaded.data) return loaded;

  const agency = loaded.data.agency;
  if (agency.billing_exempt || agency.billing_status === "billing_exempt") {
    return serviceFailure({ unsupported: true });
  }

  const methodsRes = await listPaymentMethods(supabase, agencyId);
  if (methodsRes.error) return serviceFailure({ error: methodsRes.error });
  if (methodsRes.data.some((row) => isUsableMandateStatus(row.status))) {
    return serviceFailure({ conflict: true });
  }

  let gc;
  let adminDb: SupabaseClient;
  try {
    gc = getGoCardlessClient();
    adminDb = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }

  const billingEmail = agencyBillingEmail(agency);
  const existingCustomer = await findBillingCustomerByAgencyId(adminDb, agencyId);
  if (existingCustomer.error) {
    return serviceFailure({ error: existingCustomer.error });
  }

  let gocardlessCustomerId = existingCustomer.data?.gocardless_customer_id ?? null;

  if (!gocardlessCustomerId) {
    try {
      const customer = await createOrFindOnIdempotencyConflict(
        () =>
          gc.customers.create(
            {
              email: billingEmail ?? undefined,
              company_name: agency.name,
              country_code: "GB",
              address_line1: agency.address_line1 ?? undefined,
              city: agency.city ?? undefined,
              postal_code: agency.postal_code ?? undefined,
              metadata: { agency_id: agency.id },
            },
            `customer:${agency.id}`,
          ),
        (id) => gc.customers.find(id),
      );
      gocardlessCustomerId = customer.id ?? null;
    } catch (error) {
      try {
        const customer = await gc.customers.create(
          {
            email: billingEmail ?? undefined,
            company_name: agency.name,
            country_code: "GB",
            address_line1: agency.address_line1 ?? undefined,
            city: agency.city ?? undefined,
            postal_code: agency.postal_code ?? undefined,
            metadata: { agency_id: agency.id },
          },
          `customer:${agency.id}:${randomUUID()}`,
        );
        gocardlessCustomerId = customer.id ?? null;
      } catch (retryError) {
        return serviceFailure({ error: toError(retryError) });
      }
    }

    if (!gocardlessCustomerId) {
      return serviceFailure({
        error: new Error("GoCardless customer create returned no id"),
      });
    }

    const upserted = await upsertBillingCustomer(adminDb, {
      agency_id: agency.id,
      gocardless_customer_id: gocardlessCustomerId,
      billing_email: billingEmail,
    });
    if (upserted.error) {
      return serviceFailure({ error: upserted.error });
    }
  }

  try {
    const billingRequest = await gc.billingRequests.create(
      {
        mandate_request: { scheme: GC_SCHEME },
        links: { customer: gocardlessCustomerId },
        metadata: { agency_id: agency.id },
      },
      randomUUID(),
    );

    const flow = await gc.billingRequestFlows.create({
      auto_fulfil: true,
      redirect_uri: body.successRedirectUrl,
      exit_uri: exitUrl,
      prefilled_customer: {
        company_name: agency.name,
        email: billingEmail,
        country_code: "GB",
      },
      links: { billing_request: billingRequest.id },
    });

    if (!flow.authorisation_url) {
      return serviceFailure({
        error: new Error("GoCardless billing request flow missing authorisation URL"),
      });
    }

    await insertBillingEvent(adminDb, {
      agency_id: agency.id,
      provider: GC_PROVIDER,
      event_id: `local:brq:${billingRequest.id}`,
      event_type: "billing_request.created",
      resource_type: "billing_requests",
      resource_id: billingRequest.id,
      payload: {
        billing_request_id: billingRequest.id,
        billing_request_flow_id: flow.id,
        gocardless_customer_id: gocardlessCustomerId,
      },
    });

    return serviceSuccess({
      billingRequestId: billingRequest.id,
      authorisationUrl: flow.authorisation_url,
      expiresAt: flow.expires_at ?? null,
    });
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }
}
