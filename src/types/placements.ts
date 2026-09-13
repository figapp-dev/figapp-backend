export type PlacementKind = "child" | "placed_parent";

export type PlacementStatusDto = "Active" | "Scheduled" | "Ended";

export type PlacementSubjectDto = {
  id: string;
  displayName: string;
  figappId: string | null;
  dateOfBirth: string | null;
  relationship: string | null;
  linkedChild: {
    id: string;
    displayName: string;
    figappId: string | null;
  } | null;
};

export type PlacementHouseholdSummaryDto = {
  id: string;
  name: string | null;
  figappId: string | null;
  addressLine1: string | null;
  city: string | null;
  postalCode: string | null;
};

export type PlacementFosterCarerDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
};

export type PlacementListItemDto = {
  id: string;
  kind: PlacementKind;
  status: PlacementStatusDto | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean;
  notes: string | null;
  placementTypeNames: string[];
  child: PlacementSubjectDto;
  household: PlacementHouseholdSummaryDto;
};

export type PlacementListDto = {
  items: PlacementListItemDto[];
};

export type PlacementDetailDto = PlacementListItemDto & {
  fosterCarers: PlacementFosterCarerDto[];
};

export type PlacementChildRow = {
  id: string;
  household_id: string;
  child_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  notes: string | null;
};

export type PlacementParentRow = {
  id: string;
  household_id: string;
  child_id: string;
  biological_parent_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
};

export type PlacementTypeRow = {
  id: string;
  name: string | null;
};

export type PlacementChildSummaryRow = {
  id: string;
  legal_name: string | null;
  preferred_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  figapp_id: string | null;
  placement_type_ids: string[] | null;
};
