import type { SupabaseClient } from "@supabase/supabase-js";
import {
  canReducePurchasedSeats,
  isBillableLicenceCode,
  minPurchasedSeatsAllowed,
} from "../../lib/billing-calculator.js";
import { toError } from "../../lib/errors.js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import {
  findTenantLicence,
  insertSeatChange,
  listDueScheduledSeatReductions,
  listScheduledSeatReductions,
  markSeatChangeApplied,
  setTenantLicencePurchasedSeats,
} from "../../repositories/billing.js";
import type { SeatReductionDto } from "../../types/billing.js";
import { loadManagedAgency } from "./authz.js";
import {
  countPendingInvitesByLicence,
  countUsedSeatsByLicence,
  ensureTenantLicences,
} from "./tenant-licences.js";

export async function applyDueSeatReductions(
  adminDb: SupabaseClient,
  today: string,
): Promise<{ applied: number; errors: Array<{ agencyId: string; message: string }> }> {
  const dueRes = await listDueScheduledSeatReductions(adminDb, today);
  if (dueRes.error) throw dueRes.error;

  const result = {
    applied: 0,
    errors: [] as Array<{ agencyId: string; message: string }>,
  };
  for (const change of dueRes.data) {
    try {
      await ensureTenantLicences(adminDb, change.agency_id);
      if (!isBillableLicenceCode(change.licence_code)) continue;
      const licence = await findTenantLicence(
        adminDb,
        change.agency_id,
        change.licence_code,
      );
      if (licence.error) throw licence.error;
      const current = licence.data?.seats_purchased ?? 0;
      const used =
        (await countUsedSeatsByLicence(adminDb, change.agency_id))[
          change.licence_code
        ] ?? 0;
      const pending =
        (await countPendingInvitesByLicence(adminDb, change.agency_id))[
          change.licence_code
        ] ?? 0;
      const floor = minPurchasedSeatsAllowed(change.licence_code, used, pending);
      const nextPurchased = Math.max(floor, current - change.quantity);
      if (nextPurchased !== current) {
        const bump = await setTenantLicencePurchasedSeats(adminDb, {
          agencyId: change.agency_id,
          licenceCode: change.licence_code,
          seatsPurchased: nextPurchased,
        });
        if (bump.error) throw bump.error;
      }
      const marked = await markSeatChangeApplied(adminDb, change.id);
      if (marked.error) throw marked.error;
      result.applied += 1;
    } catch (error) {
      result.errors.push({
        agencyId: change.agency_id,
        message: toError(error).message,
      });
    }
  }
  return result;
}

export async function createAgencySeatReduction(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
  body: { licenceCode: string; quantity?: number },
) {
  const loaded = await loadManagedAgency(supabase, userId, agencyId);
  if (!loaded.data) return loaded;

  const agency = loaded.data.agency;
  if (agency.billing_exempt || agency.billing_status === "billing_exempt") {
    return serviceFailure({
      unsupported: true,
      error: new Error("Exempt agencies do not manage paid seats via GoCardless"),
    });
  }

  let adminDb: SupabaseClient;
  try {
    adminDb = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }

  try {
    const data = await scheduleSeatReduction({
      adminDb,
      agencyId,
      userId,
      licenceCode: body.licenceCode,
      quantity: body.quantity ?? 1,
      periodEnd: agency.current_period_end,
    });
    return serviceSuccess(data);
  } catch (error) {
    const err = toError(error);
    const code = (error as { code?: string }).code;
    if (code === "BAD_REQUEST") return serviceFailure({ badRequest: true, error: err });
    if (code === "NOT_FOUND") return serviceFailure({ notFound: true, error: err });
    return serviceFailure({ error: err });
  }
}

async function scheduleSeatReduction(params: {
  adminDb: SupabaseClient;
  agencyId: string;
  userId: string;
  licenceCode: string;
  quantity: number;
  periodEnd: string | null;
}): Promise<SeatReductionDto> {
  const { adminDb, agencyId, licenceCode, quantity } = params;
  if (!isBillableLicenceCode(licenceCode)) {
    throw Object.assign(new Error("licenceCode is not a billable licence"), {
      code: "BAD_REQUEST",
    });
  }
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > 50) {
    throw Object.assign(new Error("quantity must be an integer from 1 to 50"), {
      code: "BAD_REQUEST",
    });
  }

  const effectiveAt = params.periodEnd ? params.periodEnd.slice(0, 10) : null;
  if (!effectiveAt) {
    throw Object.assign(
      new Error("Cannot reduce seats until the first Direct Debit period is confirmed"),
      { code: "BAD_REQUEST" },
    );
  }

  await ensureTenantLicences(adminDb, agencyId);

  const [licenceRes, usedMap, pendingMap, scheduledRes] = await Promise.all([
    findTenantLicence(adminDb, agencyId, licenceCode),
    countUsedSeatsByLicence(adminDb, agencyId),
    countPendingInvitesByLicence(adminDb, agencyId),
    listScheduledSeatReductions(adminDb, agencyId),
  ]);
  if (licenceRes.error) throw licenceRes.error;
  if (scheduledRes.error) throw scheduledRes.error;
  if (!licenceRes.data) {
    throw Object.assign(new Error("No tenant licence row for this code"), {
      code: "NOT_FOUND",
    });
  }

  const used = usedMap[licenceCode] ?? 0;
  const pendingInvites = pendingMap[licenceCode] ?? 0;
  const alreadyScheduled = scheduledRes.data
    .filter((row) => row.licence_code === licenceCode)
    .reduce((sum, row) => sum + row.quantity, 0);
  const currentPurchased = licenceRes.data.seats_purchased ?? 0;
  const targetPurchased = currentPurchased - alreadyScheduled - quantity;

  if (
    !canReducePurchasedSeats({
      licenceCode,
      currentPurchased: currentPurchased - alreadyScheduled,
      targetPurchased,
      used,
      pendingInvites,
    })
  ) {
    throw Object.assign(
      new Error(
        "Cannot reduce below the starter pack or seats that are already assigned",
      ),
      { code: "BAD_REQUEST" },
    );
  }

  const inserted = await insertSeatChange(adminDb, {
    agency_id: agencyId,
    licence_code: licenceCode,
    change_type: "reduce_scheduled",
    quantity,
    status: "scheduled",
    pro_rata_amount_pence: 0,
    effective_at: effectiveAt,
    created_by: params.userId,
  });
  if (inserted.error) throw inserted.error;

  return {
    agencyId,
    licenceCode,
    quantity,
    seatsPurchased: currentPurchased,
    seatsAfterReduction: targetPurchased,
    effectiveAt,
  };
}
