export type HouseholdRow = {
  id: string;
  household_id_system: string | null;
  agency_id?: string | null;
  name: string | null;
  status: string | null;
  max_children: number | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
  created_at?: string | null;
};

export type HouseholdCarerRow = {
  household_id: string;
  user_id: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  social_worker_id?: string | null;
};

export type HouseholdChildRow = {
  household_id: string;
  child_id: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

export type HouseholdCarerProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  figapp_id: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  social_worker_id: string | null;
};

export type HouseholdStaffProfileRow = {
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  figapp_id: string | null;
  email: string | null;
  phone: string | null;
  manager_id: string | null;
};

export type HouseholdParentPlacementRow = {
  id: string;
  child_id: string;
  household_id: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
  biological_parent_id: string;
};

export type HouseholdCarerDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  isSelf: boolean;
};

export type HouseholdCarerDetailDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  email: string | null;
  phone: string | null;
  isSelf: boolean;
};

export type HouseholdStaffMemberDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  email: string | null;
  phone: string | null;
};

export type HouseholdCurrentChildDto = {
  kind: "child" | "placed_parent";
  id: string;
  displayName: string;
  figappId: string | null;
  relationship: string | null;
  linkedChild: {
    id: string;
    displayName: string;
    figappId: string | null;
  } | null;
};

export type HouseholdListItemDto = {
  id: string;
  figappId: string | null;
  name: string;
  status: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  maxChildren: number | null;
  placedChildrenCount: number;
  fosterCarers: HouseholdCarerDto[];
};

export type HouseholdListDto = {
  households: HouseholdListItemDto[];
};

export type HouseholdDetailDto = {
  id: string;
  figappId: string | null;
  name: string;
  status: string | null;
  createdAt: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
  maxChildren: number | null;
  activeFosterCarersCount: number;
  childrenInPlacementCount: number;
  capacityUtilizationPercent: number;
  fosterCarers: HouseholdCarerDetailDto[];
  socialWorkers: HouseholdStaffMemberDto[];
  swManagers: HouseholdStaffMemberDto[];
  currentChildren: HouseholdCurrentChildDto[];
};
