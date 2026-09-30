import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveCallerContext } from "../../lib/caller-context.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  resolveSocialWorkerScope,
  resolveSwManagerScope,
} from "../../lib/social-worker-scope.js";
import { toSocialWorkerDto } from "../../mappers/social-workers.js";
import { listStaffProfilesByUserIds } from "../../repositories/households.js";
import type { SocialWorkerListDto } from "../../types/social-workers.js";

/**
 * sw_manager only (not social_worker — a social worker doesn't manage
 * other social workers). Each social worker's own foster-carer count is
 * resolved via resolveSocialWorkerScope per worker, in parallel — teams
 * are small enough that N parallel round trips is simpler and safer than
 * hand-rolling a bulk group-by query here.
 */
export async function listSocialWorkersForManager(
  supabase: SupabaseClient,
  callerUserId: string,
) {
  const callerRes = await resolveCallerContext(supabase, callerUserId);
  if (callerRes.error) return serviceFailure({ error: callerRes.error });

  const caller = callerRes.data;
  if (!caller || caller.role !== "sw_manager" || !caller.isActive) {
    return serviceFailure({ forbidden: true });
  }

  const { scope, error: scopeError } = await resolveSwManagerScope(
    supabase,
    callerUserId,
  );
  if (scopeError) return serviceFailure({ error: scopeError });

  const { socialWorkerUserIds } = scope;
  if (socialWorkerUserIds.length === 0) {
    return serviceSuccess<SocialWorkerListDto>({ socialWorkers: [] });
  }

  const [profilesRes, ...caseloadResults] = await Promise.all([
    listStaffProfilesByUserIds(supabase, socialWorkerUserIds),
    ...socialWorkerUserIds.map((id) => resolveSocialWorkerScope(supabase, id)),
  ]);

  if (profilesRes.error) return serviceFailure({ error: profilesRes.error });

  const fosterCarersCountByUserId = new Map<string, number>();
  socialWorkerUserIds.forEach((id, index) => {
    const result = caseloadResults[index];
    fosterCarersCountByUserId.set(
      id,
      result.error ? 0 : result.scope.fosterCarerUserIds.length,
    );
  });

  const profilesByUserId = new Map(
    profilesRes.data.map((profile) => [profile.user_id, profile]),
  );

  const socialWorkers = socialWorkerUserIds
    .map((id) => {
      const profile = profilesByUserId.get(id);
      if (!profile) return null;
      return toSocialWorkerDto({
        profile,
        fosterCarersCount: fosterCarersCountByUserId.get(id) ?? 0,
      });
    })
    .filter((dto): dto is NonNullable<typeof dto> => dto != null)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return serviceSuccess<SocialWorkerListDto>({ socialWorkers });
}
