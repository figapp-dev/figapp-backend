import type {
  AllergyDto,
  AllergyRow,
  BiologicalParentRow,
  ChildDetailDto,
  ChildDetailRow,
  ChildListItemDto,
  ChildListRow,
  ContactRow,
  CurrentPlacementDto,
  CurrentPlacementRow,
  EmergencyContactDto,
  LinkedChildSummaryDto,
  MedicalConditionDto,
  MedicalConditionRow,
  PlacementHistoryItemDto,
  PlacementHouseholdDto,
  PlacementHouseholdRow,
  PlacedParentDetailDto,
  PlacedParentListItemDto,
  ProfessionalContactDto,
} from "../types/children.js";
import { getPlacementDisplayStatus } from "../lib/placement-status.js";

function buildChildDisplayName(row: ChildListRow): string {
  if (row.preferred_name?.trim()) {
    return row.preferred_name.trim();
  }

  const parts = [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (parts) return parts;
  return row.legal_name?.trim() || "Unknown child";
}

export function toChildListItemDto(
  row: ChildListRow,
  placedSince: string | null,
  isParentChildPlacement: boolean,
): ChildListItemDto {
  return {
    kind: "child",
    id: row.id,
    figappId: row.figapp_id,
    status: row.status,
    displayName: buildChildDisplayName(row),
    legalName: row.legal_name,
    preferredName: row.preferred_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    genderIdentity: row.gender_identity,
    genderIdentityDescription: row.gender_identity_description,
    pronouns: row.pronouns,
    isParentChildPlacement,
    placedSince,
    isPlaced: true,
  };
}

export function toPlacedParentListItemDto(
  parent: BiologicalParentRow,
  childId: string,
  placedSince: string | null,
): PlacedParentListItemDto {
  return {
    kind: "placed_parent",
    id: parent.id,
    displayName: parent.name?.trim() || "Parent",
    figappId: parent.figapp_id,
    dateOfBirth: parent.date_of_birth,
    relationship: parent.relationship,
    badge: "Parent Child",
    childId,
    placedSince,
    isPlaced: true,
  };
}

function toAllergyDto(row: AllergyRow): AllergyDto | null {
  const allergy = row.allergy?.trim();
  if (!allergy) return null;
  return { id: row.id, allergy };
}

function toMedicalConditionDto(
  row: MedicalConditionRow,
): MedicalConditionDto | null {
  const condition = row.condition?.trim();
  if (!condition) return null;
  return { id: row.id, condition };
}

function toEmergencyContactDto(row: ContactRow): EmergencyContactDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
  };
}

function toProfessionalContactDto(row: ContactRow): ProfessionalContactDto {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email,
    relationship: row.relationship,
  };
}

function toPlacementHouseholdDto(
  householdRaw: PlacementHouseholdRow | PlacementHouseholdRow[] | null,
): PlacementHouseholdDto | null {
  const household = Array.isArray(householdRaw)
    ? (householdRaw[0] ?? null)
    : householdRaw;

  if (!household) return null;

  return {
    id: household.id,
    name: household.name,
    addressLine1: household.address_line1,
    addressLine2: household.address_line2,
    city: household.city,
    postalCode: household.postal_code,
    country: household.country,
  };
}

function toCurrentPlacementDto(
  row: CurrentPlacementRow | null,
): CurrentPlacementDto | null {
  if (!row) return null;

  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    household: toPlacementHouseholdDto(row.carer_households),
  };
}

export function toPlacementHistoryItemDto(
  row: CurrentPlacementRow,
): PlacementHistoryItemDto {
  return {
    id: row.id,
    startDate: row.start_date,
    endDate: row.end_date,
    isActive: row.is_active === true,
    status: getPlacementDisplayStatus(row),
    childId: row.child_id ?? null,
    household: toPlacementHouseholdDto(row.carer_households),
  };
}

export function toChildDetailDto(
  row: ChildDetailRow,
  isParentChildPlacement: boolean,
  allergies: AllergyRow[],
  medicalConditions: MedicalConditionRow[],
  emergencyContacts: ContactRow[],
  professionalContacts: ContactRow[],
  currentPlacement: CurrentPlacementRow | null,
): ChildDetailDto {
  return {
    kind: "child",
    id: row.id,
    figappId: row.figapp_id,
    status: row.status,
    displayName: buildChildDisplayName(row),
    legalName: row.legal_name,
    preferredName: row.preferred_name,
    firstName: row.first_name,
    middleName: row.middle_name,
    lastName: row.last_name,
    dateOfBirth: row.date_of_birth,
    genderIdentity: row.gender_identity,
    genderIdentityDescription: row.gender_identity_description,
    pronouns: row.pronouns,
    isParentChildPlacement,
    allergies: allergies
      .map(toAllergyDto)
      .filter((item): item is AllergyDto => item !== null),
    medicalConditions: medicalConditions
      .map(toMedicalConditionDto)
      .filter((item): item is MedicalConditionDto => item !== null),
    emergencyContacts: emergencyContacts.map(toEmergencyContactDto),
    professionalContacts: professionalContacts.map(toProfessionalContactDto),
    currentPlacement: toCurrentPlacementDto(currentPlacement),
  };
}

export function toLinkedChildSummaryDto(
  row: ChildListRow,
): LinkedChildSummaryDto {
  return {
    id: row.id,
    displayName: buildChildDisplayName(row),
    figappId: row.figapp_id,
  };
}

export function toPlacedParentDetailDto(
  parent: BiologicalParentRow,
  childId: string,
  linkedChild: LinkedChildSummaryDto | null,
  currentPlacement: CurrentPlacementRow | null,
): PlacedParentDetailDto {
  return {
    kind: "placed_parent",
    id: parent.id,
    displayName: parent.name?.trim() || "Parent",
    figappId: parent.figapp_id,
    dateOfBirth: parent.date_of_birth,
    relationship: parent.relationship,
    phone: parent.phone ?? null,
    email: parent.email ?? null,
    badge: "Parent Child",
    childId,
    linkedChild,
    currentPlacement: toCurrentPlacementDto(currentPlacement),
  };
}
