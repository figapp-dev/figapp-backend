import type { HouseholdStaffProfileRow } from "../types/households.js";
import type { SocialWorkerDto } from "../types/social-workers.js";

function staffDisplayName(profile: {
  first_name: string | null;
  last_name: string | null;
}): string {
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return full || "Social worker";
}

export function toSocialWorkerDto(params: {
  profile: HouseholdStaffProfileRow;
  fosterCarersCount: number;
}): SocialWorkerDto {
  const { profile, fosterCarersCount } = params;
  return {
    userId: profile.user_id,
    displayName: staffDisplayName(profile),
    figappId: profile.figapp_id,
    email: profile.email,
    phone: profile.phone,
    fosterCarersCount,
  };
}
