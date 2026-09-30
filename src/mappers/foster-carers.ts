import type { HouseholdCarerProfileRow, HouseholdRow } from "../types/households.js";
import type { FosterCarerDto } from "../types/foster-carers.js";

function carerDisplayName(profile: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return full || "Foster carer";
}

export function toFosterCarerDto(params: {
  profile: HouseholdCarerProfileRow;
  householdIds: string[];
  householdsById: Map<string, HouseholdRow>;
}): FosterCarerDto {
  const { profile, householdIds, householdsById } = params;

  const households = householdIds
    .map((id) => householdsById.get(id))
    .filter((h): h is HouseholdRow => h != null)
    .map((h) => ({ id: h.id, name: (h.name ?? "").trim() || "Household" }));

  return {
    userId: profile.user_id,
    displayName: carerDisplayName(profile),
    figappId: profile.figapp_id,
    email: profile.email,
    phone: profile.phone,
    households,
  };
}
