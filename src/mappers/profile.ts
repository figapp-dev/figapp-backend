import type { ProfileDto, ProfileRow } from "../types/profile.js";
export function toProfileDto(row: ProfileRow): ProfileDto {
  return {
    id: row.user_id,
    agencyUserId: row.id,
    email: row.email,
    firstName: row.first_name,
    lastName: row.last_name,
    preferredName: row.preferred_name,
    phone: row.phone,
    role: row.role,
    position: row.position,
    jobTitle: row.job_title,
    dateOfBirth: row.date_of_birth,
    gender: row.gender,
    figappId: row.figapp_id,
    status: row.status,
    isActive: row.is_active,
    agency: row.agencies
      ? {
          id: row.agencies.id,
          name: row.agencies.name,
        }
      : null,
    household: row.carer_households
      ? {
          id: row.carer_households.id,
          name: row.carer_households.name,
          addressLine1: row.carer_households.address_line1,
          addressLine2: row.carer_households.address_line2,
          city: row.carer_households.city,
          postalCode: row.carer_households.postal_code,
          country: row.carer_households.country,
        }
      : null,
  };
}
