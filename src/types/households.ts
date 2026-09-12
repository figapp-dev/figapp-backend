export type HouseholdRow = {
  id: string;
  household_id_system: string | null;
  name: string | null;
  status: string | null;
  max_children: number | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

export type HouseholdCarerRow = {
  household_id: string;
  user_id: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

export type HouseholdChildRow = {
  household_id: string;
  child_id: string;
  is_active: boolean | null;
  start_date: string | null;
  end_date: string | null;
};

export type HouseholdCarerDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  isSelf: boolean;
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
