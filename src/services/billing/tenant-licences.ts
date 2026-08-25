import type { SupabaseClient } from "@supabase/supabase-js";
import {
  BILLABLE_LICENCE_CODES,
  ensurePurchasedSeats,
  isBillableLicenceCode,
  licenceCodeForRole,
} from "../../lib/billing-calculator.js";
import {
  listAgencyUsersForSeats,
  listPendingInviteRoles,
  listTenantLicences,
  upsertTenantLicence,
} from "../../repositories/billing.js";

function isActiveAgencyUser(row: {
  is_active: boolean | null;
  is_archived: boolean | null;
}): boolean {
  return row.is_archived !== true && row.is_active !== false;
}

export async function countUsedSeatsByLicence(
  adminDb: SupabaseClient,
  agencyId: string,
): Promise<Record<string, number>> {
  const usersRes = await listAgencyUsersForSeats(adminDb, agencyId);
  if (usersRes.error) throw usersRes.error;

  const used: Record<string, number> = {};
  for (const user of usersRes.data) {
    if (!isActiveAgencyUser(user)) continue;
    const licenceCode = licenceCodeForRole(user.role);
    if (!licenceCode) continue;
    used[licenceCode] = (used[licenceCode] ?? 0) + 1;
  }
  return used;
}

export async function countPendingInvitesByLicence(
  adminDb: SupabaseClient,
  agencyId: string,
): Promise<Record<string, number>> {
  const invitesRes = await listPendingInviteRoles(adminDb, agencyId);
  if (invitesRes.error) throw invitesRes.error;

  const pending: Record<string, number> = {};
  for (const role of invitesRes.data) {
    const licenceCode = licenceCodeForRole(role);
    if (!licenceCode) continue;
    pending[licenceCode] = (pending[licenceCode] ?? 0) + 1;
  }
  return pending;
}

/**
 * Write starter-pack tenant_licences for agencies that never got rows.
 * Covers existing users; never lowers already-purchased seats.
 */
export async function ensureTenantLicences(
  adminDb: SupabaseClient,
  agencyId: string,
): Promise<void> {
  const [used, existingRes] = await Promise.all([
    countUsedSeatsByLicence(adminDb, agencyId),
    listTenantLicences(adminDb, agencyId),
  ]);
  if (existingRes.error) throw existingRes.error;

  const byCode = new Map(
    existingRes.data
      .filter((row) => isBillableLicenceCode(row.licence_code))
      .map((row) => [row.licence_code, row]),
  );

  for (const licenceCode of BILLABLE_LICENCE_CODES) {
    const row = byCode.get(licenceCode);
    const usedCount = used[licenceCode] ?? 0;
    const seatsPurchased = ensurePurchasedSeats(
      licenceCode,
      usedCount,
      row?.seats_purchased,
    );
    const upsert = await upsertTenantLicence(adminDb, {
      agency_id: agencyId,
      licence_code: licenceCode,
      seats_purchased: seatsPurchased,
      seats_used: usedCount,
    });
    if (upsert.error) throw upsert.error;
  }
}
