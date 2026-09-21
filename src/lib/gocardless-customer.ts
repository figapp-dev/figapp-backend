import { ErrorMessages } from "../constants/error-messages.js";

/**
 * GoCardless Bacs customers need a complete UK address (line 1, city, postcode)
 * or no address at all so the hosted flow can collect it. Partial addresses
 * (street + city, no postcode) are rejected and fail Direct Debit setup.
 */
export type GoCardlessAddressFields = {
  address_line1: string;
  city: string;
  postal_code: string;
  country_code: "GB";
};

export function completeGoCardlessAddress(agency: {
  address_line1: string | null;
  city: string | null;
  postal_code: string | null;
}): GoCardlessAddressFields | null {
  const address_line1 = agency.address_line1?.trim() ?? "";
  const city = agency.city?.trim() ?? "";
  const postal_code = agency.postal_code?.trim() ?? "";
  if (!address_line1 || !city || !postal_code) return null;
  return { address_line1, city, postal_code, country_code: "GB" };
}

export function goCardlessCustomerCreateParams(
  agency: {
    id: string;
    name: string;
    address_line1: string | null;
    city: string | null;
    postal_code: string | null;
  },
  email: string | null,
) {
  const address = completeGoCardlessAddress(agency);
  return {
    email: email ?? undefined,
    company_name: agency.name,
    country_code: "GB" as const,
    ...(address ?? {}),
    metadata: { agency_id: agency.id },
  };
}

export function goCardlessPrefilledCustomer(
  agency: { name: string },
  email: string | null,
) {
  return {
    company_name: agency.name,
    country_code: "GB" as const,
    ...(email ? { email } : {}),
  };
}

export function friendlyGoCardlessStartError(error: Error | null | undefined): string {
  const raw = (error?.message ?? "").toLowerCase();
  if (
    raw.includes("postal_code") ||
    raw.includes("address_line") ||
    raw.includes("address")
  ) {
    return ErrorMessages.BILLING_ADDRESS_INCOMPLETE;
  }
  if (raw.includes("redirect_uri")) {
    return ErrorMessages.BILLING_REDIRECT_URL_INVALID;
  }
  return ErrorMessages.BILLING_REQUEST_FAILED;
}
