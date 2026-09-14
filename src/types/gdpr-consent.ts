export const GDPR_CONSENT_TYPE = "data_processing" as const;
export const GDPR_CONSENT_VERSION = "1.0" as const;

export type GdprConsentStatus = "none" | "accepted" | "declined";

export type GdprConsentDto = {
  needsPrompt: boolean;
  status: GdprConsentStatus;
  id: string | null;
  consentGiven: boolean | null;
  consentDate: string | null;
  consentVersion: string | null;
  legalBasis: string | null;
};

export type PutGdprConsentBody = {
  given: boolean;
};

export type GdprConsentRow = {
  id: string;
  user_id: string;
  agency_id: string | null;
  consent_type: string;
  consent_given: boolean;
  consent_text: string;
  consent_version: string;
  legal_basis: string;
  consent_date: string;
  withdrawal_date: string | null;
  metadata: Record<string, unknown> | null;
};
