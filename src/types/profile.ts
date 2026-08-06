export type AgencyDto = {
  id: string;
  name: string;
};
export type HouseholdDto = {
  id: string;
  name: string;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
};

export type ProfileDto = {
  id: string;
  agencyUserId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  preferredName: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  jobTitle: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  figappId: string | null;
  status: string | null;
  isActive: boolean | null;
  agency: AgencyDto | null;
  household: HouseholdDto | null;
};
export type ProfileRow = {
  id: string;
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  preferred_name: string | null;
  phone: string | null;
  role: string;
  position: string | null;
  job_title: string | null;
  date_of_birth: string | null;
  gender: string | null;
  figapp_id: string | null;
  status: string | null;
  is_active: boolean | null;
  agencies: { id: string; name: string } | null;
  carer_households: {
    id: string;
    name: string;
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    postal_code: string | null;
    country: string | null;
  } | null;
};
