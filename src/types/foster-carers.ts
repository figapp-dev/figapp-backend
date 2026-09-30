export type FosterCarerHouseholdDto = {
  id: string;
  name: string;
};

export type FosterCarerDto = {
  userId: string;
  displayName: string;
  figappId: string | null;
  email: string | null;
  phone: string | null;
  households: FosterCarerHouseholdDto[];
};

export type FosterCarerListDto = {
  fosterCarers: FosterCarerDto[];
};
