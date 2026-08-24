import type { GoCardlessClient } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  hasUsablePaymentMethod,
  isUsableMandateStatus,
} from "../../lib/billing-access.js";
import {
  isBillableLicenceCode,
  parseDateOnly,
  quoteMidCycleSeatAddition,
} from "../../lib/billing-calculator.js";
import { toError } from "../../lib/errors.js";
import {
  createOrFindOnIdempotencyConflict,
  GC_CURRENCY,
  GC_LICENCE_PAYMENT_NAME,
  getGoCardlessClient,
  penceToGcAmount,
} from "../../lib/gocardless.js";
import { toLicencePrices } from "../../mappers/billing.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  findTenantLicence,
  insertSeatChange,
  listActiveLicenceTypes,
  listPaymentMethods,
  setTenantLicencePurchasedSeats,
} from "../../repositories/billing.js";
import type {
  AgencyBillingRow,
  MoneyLineItem,
  SeatChargeDto,
} from "../../types/billing.js";
import { loadManagedAgency } from "./authz.js";
import { upsertInvoiceForPayment } from "./subscription.js";

export type SeatChargeResult = SeatChargeDto;

function defaultUsableMandateId(
  methods: Array<{
    gocardless_mandate_id: string;
    status: string;
    is_default: boolean;
  }>,
): string | null {
  const usable = methods.filter((row) => isUsableMandateStatus(row.status));
  const preferred = usable.find((row) => row.is_default) ?? usable[0];
  return preferred?.gocardless_mandate_id ?? null;
}

export async function chargeMidCycleSeats(params: {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  licenceCode: string;
  quantity: number;
  asOf?: Date;
}): Promise<SeatChargeDto> {
  const { adminDb, gc, agency } = params;
  if (!isBillableLicenceCode(params.licenceCode)) {
    throw Object.assign(new Error("licenceCode is not a billable licence"), {
      code: "BAD_REQUEST",
    });
  }
  if (!Number.isInteger(params.quantity) || params.quantity < 1 || params.quantity > 50) {
    throw Object.assign(new Error("quantity must be an integer from 1 to 50"), {
      code: "BAD_REQUEST",
    });
  }
  if (agency.billing_exempt || agency.billing_status === "billing_exempt") {
    throw Object.assign(new Error("Exempt agencies do not buy extra seats via GoCardless"), {
      code: "UNSUPPORTED",
    });
  }

  const periodStart = agency.current_period_start ?? agency.billing_cycle_anchor;
  const periodEnd = agency.current_period_end;
  if (!periodStart || !periodEnd) {
    throw Object.assign(
      new Error("Billing period is not set until the first Direct Debit confirms"),
      { code: "BAD_REQUEST" },
    );
  }

  const methods = await listPaymentMethods(adminDb, agency.id);
  if (methods.error) throw methods.error;
  if (!hasUsablePaymentMethod(methods.data)) {
    throw Object.assign(new Error("No usable Direct Debit mandate"), {
      code: "CONFLICT",
    });
  }
  const mandateId = defaultUsableMandateId(methods.data);
  if (!mandateId) {
    throw Object.assign(new Error("No usable Direct Debit mandate"), {
      code: "CONFLICT",
    });
  }

  const [licenceRes, pricesRes] = await Promise.all([
    findTenantLicence(adminDb, agency.id, params.licenceCode),
    listActiveLicenceTypes(adminDb),
  ]);
  if (licenceRes.error) throw licenceRes.error;
  if (pricesRes.error) throw pricesRes.error;
  if (!licenceRes.data) {
    throw Object.assign(new Error("No tenant licence row for this code"), {
      code: "NOT_FOUND",
    });
  }

  const prices = toLicencePrices(pricesRes.data);
  const price = prices.find((row) => row.code === params.licenceCode);
  if (!price) {
    throw Object.assign(new Error("Missing catalogue price for this licence"), {
      code: "BAD_REQUEST",
    });
  }

  const currentPurchased = licenceRes.data.seats_purchased ?? 0;
  const seatsPurchased = currentPurchased + params.quantity;
  const { amountPence } = quoteMidCycleSeatAddition({
    licenceCode: params.licenceCode,
    quantity: params.quantity,
    currentPurchased,
    price,
    periodStart: parseDateOnly(periodStart),
    periodEnd: parseDateOnly(periodEnd),
    asOf: params.asOf,
  });

  const idempotencyKey = `prorata:${agency.id}:${params.licenceCode}:${currentPurchased}:${seatsPurchased}:${periodStart}`;
  let paymentId: string | null = null;

  if (amountPence > 0) {
    const lineItems: MoneyLineItem[] = [
      {
        code: params.licenceCode,
        label: `Extra ${params.licenceCode} seat (pro-rata)`,
        quantity: params.quantity,
        unitAmountPence: Math.round(amountPence / params.quantity),
        amountPence,
      },
    ];
    const payment = await createOrFindOnIdempotencyConflict(
      () =>
        gc.payments.create(
          {
            amount: penceToGcAmount(amountPence),
            currency: GC_CURRENCY,
            description: `${GC_LICENCE_PAYMENT_NAME} (mid-cycle seats)`,
            retry_if_possible: true,
            links: { mandate: mandateId },
            metadata: {
              agency_id: agency.id,
              kind: "seat_prorata",
              licence_code: params.licenceCode,
              period_start: periodStart,
            },
          },
          idempotencyKey,
        ),
      (id) => gc.payments.find(id),
    );
    paymentId = payment.id ?? null;
    if (!paymentId) throw new Error("GoCardless seat payment missing id");

    await upsertInvoiceForPayment({
      adminDb,
      agencyId: agency.id,
      payment,
      status: "open",
      subscriptionId: null,
      lineItems,
      periodStart,
      periodEnd,
    });
  }

  if (currentPurchased !== seatsPurchased) {
    const bump = await setTenantLicencePurchasedSeats(adminDb, {
      agencyId: agency.id,
      licenceCode: params.licenceCode,
      seatsPurchased,
    });
    if (bump.error) throw bump.error;
  }

  const change = await insertSeatChange(adminDb, {
    agency_id: agency.id,
    licence_code: params.licenceCode,
    quantity: params.quantity,
    amount_pence: amountPence,
    period_start: periodStart,
    period_end: periodEnd,
    gocardless_payment_id: paymentId,
    change_type: "prorata_add",
  });
  if (change.error) throw change.error;

  return {
    agencyId: agency.id,
    licenceCode: params.licenceCode,
    quantity: params.quantity,
    seatsPurchased,
    amountPence,
    periodStart,
    periodEnd,
    gocardlessPaymentId: paymentId,
  };
}

export async function createAgencySeatCharge(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
  body: { licenceCode: string; quantity?: number },
) {
  const loaded = await loadManagedAgency(supabase, userId, agencyId);
  if (!loaded.data) return loaded;

  let gc: GoCardlessClient;
  let adminDb: SupabaseClient;
  try {
    gc = getGoCardlessClient();
    adminDb = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }

  try {
    const data = await chargeMidCycleSeats({
      adminDb,
      gc,
      agency: loaded.data.agency,
      licenceCode: body.licenceCode,
      quantity: body.quantity ?? 1,
    });
    return serviceSuccess(data);
  } catch (error) {
    const err = toError(error);
    const code = (error as { code?: string }).code;
    if (code === "BAD_REQUEST") return serviceFailure({ badRequest: true, error: err });
    if (code === "NOT_FOUND") return serviceFailure({ notFound: true, error: err });
    if (code === "CONFLICT") return serviceFailure({ conflict: true, error: err });
    if (code === "UNSUPPORTED") return serviceFailure({ unsupported: true, error: err });
    return serviceFailure({ error: err });
  }
}
