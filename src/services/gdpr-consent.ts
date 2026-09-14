import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../lib/service-result.js";
import {
  findAgencyIdForUser,
  insertGdprConsent,
  listGdprConsentsForUser,
  withdrawGdprConsent,
} from "../repositories/gdpr-consent.js";
import {
  GDPR_CONSENT_TYPE,
  GDPR_CONSENT_VERSION,
  type GdprConsentDto,
  type GdprConsentRow,
  type GdprConsentStatus,
} from "../types/gdpr-consent.js";

/** Same stored wording as web GDPRConsentBanner — keep versions aligned. */
const ACCEPT_TEXT =
  "I consent to the processing of my personal data for the provision of foster care services, including case management, placement coordination, and regulatory compliance. This processing is necessary for the performance of public tasks carried out in the public interest in the field of child welfare.";

const DECLINE_TEXT =
  "I do not consent to the processing of my personal data beyond what is strictly necessary for legal compliance.";

function isActiveGrant(row: GdprConsentRow): boolean {
  return (
    row.consent_type === GDPR_CONSENT_TYPE &&
    row.consent_given === true &&
    !row.withdrawal_date
  );
}

function toDto(rows: GdprConsentRow[]): GdprConsentDto {
  const latest = rows[0] ?? null;
  const active = rows.find(isActiveGrant) ?? null;

  let status: GdprConsentStatus = "none";
  if (active) {
    status = "accepted";
  } else if (latest && latest.consent_given === false) {
    status = "declined";
  } else if (latest && latest.withdrawal_date) {
    status = "declined";
  }

  const source = active ?? latest;
  return {
    needsPrompt: !active,
    status,
    id: source?.id ?? null,
    consentGiven: source ? source.consent_given && !source.withdrawal_date : null,
    consentDate: source?.consent_date ?? null,
    consentVersion: source?.consent_version ?? null,
    legalBasis: source?.legal_basis ?? null,
  };
}

export async function getGdprConsent(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data, error } = await listGdprConsentsForUser(supabase, userId);
  if (error) return serviceFailure({ error });
  return serviceSuccess(toDto(data));
}

export async function putGdprConsent(
  supabase: SupabaseClient,
  userId: string,
  given: boolean,
) {
  const listed = await listGdprConsentsForUser(supabase, userId);
  if (listed.error) return serviceFailure({ error: listed.error });

  const active = listed.data.find(isActiveGrant) ?? null;

  // Withdraw existing grant when declining after accept (matches web withdraw).
  if (!given && active) {
    const withdrawn = await withdrawGdprConsent(
      supabase,
      active.id,
      userId,
      "withdrawn_via_mobile",
    );
    if (withdrawn.error || !withdrawn.data) {
      return serviceFailure({ error: withdrawn.error });
    }
    const refreshed = await listGdprConsentsForUser(supabase, userId);
    if (refreshed.error) return serviceFailure({ error: refreshed.error });
    return serviceSuccess(toDto(refreshed.data));
  }

  // Already accepted — idempotent.
  if (given && active) {
    return serviceSuccess(toDto(listed.data));
  }

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) return serviceFailure({ error: agency.error });

  const inserted = await insertGdprConsent(supabase, {
    user_id: userId,
    agency_id: agency.data,
    consent_type: GDPR_CONSENT_TYPE,
    consent_given: given,
    consent_text: given ? ACCEPT_TEXT : DECLINE_TEXT,
    consent_version: GDPR_CONSENT_VERSION,
    legal_basis: given ? "public_task" : "legal_obligation",
    metadata: {
      source: "figapp_mobile",
      recorded_via: given ? "accept" : "decline",
    },
  });

  if (inserted.error || !inserted.data) {
    return serviceFailure({ error: inserted.error });
  }

  const refreshed = await listGdprConsentsForUser(supabase, userId);
  if (refreshed.error) return serviceFailure({ error: refreshed.error });
  return serviceSuccess(toDto(refreshed.data));
}
