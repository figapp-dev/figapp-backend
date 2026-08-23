import type { SupabaseClient } from "@supabase/supabase-js";
import {
  serviceFailure,
  serviceSuccess,
} from "../../lib/service-result.js";
import {
  findAgencyBillingById,
  findAgencyUserByUserId,
  findGlobalUserRole,
} from "../../repositories/billing.js";
import type { AgencyBillingRow, BillingCaller } from "../../types/billing.js";

export type BillingAuthzResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<typeof serviceSuccess<BillingCaller>>);

export type ManagedAgencyResult =
  | ReturnType<typeof serviceFailure>
  | (ReturnType<
      typeof serviceSuccess<{ caller: BillingCaller; agency: AgencyBillingRow }>
    >);

/**
 * Identity for billing: JWT user id → agency_users + global_user_roles.
 * Never trust a body agencyId until this caller is checked against the row.
 */
export async function getBillingCaller(
  supabase: SupabaseClient,
  userId: string,
): Promise<BillingAuthzResult> {
  const [agencyUserRes, globalRoleRes] = await Promise.all([
    findAgencyUserByUserId(supabase, userId),
    findGlobalUserRole(supabase, userId),
  ]);

  if (agencyUserRes.error) {
    return serviceFailure({ error: agencyUserRes.error });
  }
  if (globalRoleRes.error) {
    return serviceFailure({ error: globalRoleRes.error });
  }

  const globalRole = globalRoleRes.data;
  const isSuperAdmin =
    !!globalRole &&
    globalRole.is_active &&
    globalRole.role === "super_admin";
  const isPlatformAdmin =
    !!globalRole &&
    globalRole.is_active &&
    (globalRole.role === "super_admin" || globalRole.role === "app_admin");

  return serviceSuccess({
    userId,
    agencyUser: agencyUserRes.data,
    isSuperAdmin,
    isPlatformAdmin,
  });
}

/**
 * Payment setup / summary: primary agency admin or superadmin only.
 * If primary_admin_id is not linked yet, the agency's first agency_admin may set up DD.
 */
export function canManageAgencyBilling(
  caller: BillingCaller,
  agency: { id: string; primary_admin_id: string | null },
): boolean {
  if (caller.isSuperAdmin) return true;
  if (agency.primary_admin_id && agency.primary_admin_id === caller.userId) {
    return true;
  }
  const au = caller.agencyUser;
  if (
    !agency.primary_admin_id &&
    au &&
    au.agency_id === agency.id &&
    au.role === "agency_admin" &&
    au.is_active !== false
  ) {
    return true;
  }
  return false;
}

export async function loadManagedAgency(
  supabase: SupabaseClient,
  userId: string,
  agencyId: string,
): Promise<ManagedAgencyResult> {
  const caller = await getBillingCaller(supabase, userId);
  if (!caller.data) return caller;

  const agencyRes = await findAgencyBillingById(supabase, agencyId);
  if (agencyRes.error) {
    return serviceFailure({ error: agencyRes.error });
  }
  if (!agencyRes.data) {
    return serviceFailure({ notFound: true });
  }
  if (!canManageAgencyBilling(caller.data, agencyRes.data)) {
    return serviceFailure({ forbidden: true });
  }

  return serviceSuccess({ caller: caller.data, agency: agencyRes.data });
}
