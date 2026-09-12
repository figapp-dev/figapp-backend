import {
  isActiveHouseholdLinkForToday,
  isCurrentlyActivePlacement,
} from "../lib/placement-status.js";
import type {
  HouseholdCarerDto,
  HouseholdCarerRow,
  HouseholdChildRow,
  HouseholdListItemDto,
  HouseholdRow,
} from "../types/households.js";

function displayName(profile: {
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
}): string {
  const preferred = profile.preferred_name?.trim();
  if (preferred) return preferred;
  const full = `${profile.first_name ?? ""} ${profile.last_name ?? ""}`.trim();
  return full || "Foster carer";
}

export function toHouseholdListItemDto(params: {
  household: HouseholdRow;
  carerLinks: HouseholdCarerRow[];
  childRows: HouseholdChildRow[];
  profilesByUserId: Map<
    string,
    {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      preferred_name: string | null;
      figapp_id: string | null;
    }
  >;
  currentUserId: string;
}): HouseholdListItemDto {
  const { household, currentUserId } = params;

  const fosterCarers: HouseholdCarerDto[] = [];
  for (const link of params.carerLinks) {
    if (!isActiveHouseholdLinkForToday(link)) continue;
    const profile = params.profilesByUserId.get(link.user_id);
    if (!profile) continue;
    fosterCarers.push({
      userId: link.user_id,
      displayName: displayName(profile),
      figappId: profile.figapp_id,
      isSelf: link.user_id === currentUserId,
    });
  }
  fosterCarers.sort((a, b) => {
    if (a.isSelf !== b.isSelf) return a.isSelf ? -1 : 1;
    return a.displayName.localeCompare(b.displayName);
  });

  const placedChildrenCount = params.childRows.filter((row) =>
    isCurrentlyActivePlacement(row),
  ).length;

  return {
    id: household.id,
    figappId: household.household_id_system,
    name: (household.name ?? "").trim() || "Household",
    status: household.status,
    addressLine1: household.address_line1,
    addressLine2: household.address_line2,
    city: household.city,
    postalCode: household.postal_code,
    country: household.country,
    maxChildren: household.max_children,
    placedChildrenCount,
    fosterCarers,
  };
}
