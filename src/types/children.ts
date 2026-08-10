export type ChildListItemDto = {
  kind: "child";
  id: string;
  figappId: string | null;
  status: string | null;
  displayName: string;
  legalName: string | null;
  preferredName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  genderIdentity: string | null;
  genderIdentityDescription: string | null;
  pronouns: string | null;
  isParentChildPlacement: boolean;
  placedSince: string | null;
  isPlaced: boolean;
};

export type PlacedParentListItemDto = {
  kind: "placed_parent";
  id: string;
  displayName: string;
  figappId: string | null;
  dateOfBirth: string | null;
  relationship: string | null;
  badge: "Parent Child";
  childId: string;
  placedSince: string | null;
  isPlaced: boolean;
};

export type ChildrenListItemDto = ChildListItemDto | PlacedParentListItemDto;

export type ChildrenListDto = {
  items: ChildrenListItemDto[];
};

export type ChildListRow = {
  id: string;
  legal_name: string | null;
  preferred_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  gender_identity: string | null;
  gender_identity_description: string | null;
  pronouns: string | null;
  figapp_id: string | null;
  status: string | null;
  placement_type_ids: string[] | null;
};

export type HouseholdChildRow = {
  id: string;
  child_id: string;
  start_date: string | null;
  is_active: boolean | null;
  end_date: string | null;
};

export type BiologicalParentRow = {
  id: string;
  name: string | null;
  date_of_birth: string | null;
  figapp_id: string | null;
  relationship: string | null;
  phone?: string | null;
  email?: string | null;
};

export type BiologicalParentPlacementRow = {
  id: string;
  child_id: string;
  household_id: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  child_biological_parents: BiologicalParentRow | BiologicalParentRow[] | null;
};

export type AllergyDto = {
  id: string;
  allergy: string;
};

export type MedicalConditionDto = {
  id: string;
  condition: string;
};

export type EmergencyContactDto = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

export type ProfessionalContactDto = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

export type PlacementHouseholdDto = {
  id: string;
  name: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  postalCode: string | null;
  country: string | null;
};

export type CurrentPlacementDto = {
  id: string;
  startDate: string | null;
  endDate: string | null;
  household: PlacementHouseholdDto | null;
};

export type LinkedChildSummaryDto = {
  id: string;
  displayName: string;
  figappId: string | null;
};

export type ChildDetailDto = {
  kind: "child";
  id: string;
  figappId: string | null;
  status: string | null;
  displayName: string;
  legalName: string | null;
  preferredName: string | null;
  firstName: string | null;
  middleName: string | null;
  lastName: string | null;
  dateOfBirth: string | null;
  genderIdentity: string | null;
  genderIdentityDescription: string | null;
  pronouns: string | null;
  isParentChildPlacement: boolean;
  allergies: AllergyDto[];
  medicalConditions: MedicalConditionDto[];
  emergencyContacts: EmergencyContactDto[];
  professionalContacts: ProfessionalContactDto[];
  currentPlacement: CurrentPlacementDto | null;
};

export type PlacedParentDetailDto = {
  kind: "placed_parent";
  id: string;
  displayName: string;
  figappId: string | null;
  dateOfBirth: string | null;
  relationship: string | null;
  phone: string | null;
  email: string | null;
  badge: "Parent Child";
  childId: string;
  linkedChild: LinkedChildSummaryDto | null;
  currentPlacement: CurrentPlacementDto | null;
};

export type ChildrenDetailDto = ChildDetailDto | PlacedParentDetailDto;

export type ChildDetailRow = ChildListRow;

export type AllergyRow = {
  id: string;
  allergy: string | null;
};

export type MedicalConditionRow = {
  id: string;
  condition: string | null;
};

export type ContactRow = {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  relationship: string | null;
};

export type PlacementHouseholdRow = {
  id: string;
  name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  postal_code: string | null;
  country: string | null;
};

export type CurrentPlacementRow = {
  id: string;
  start_date: string | null;
  end_date: string | null;
  carer_households: PlacementHouseholdRow | PlacementHouseholdRow[] | null;
};
