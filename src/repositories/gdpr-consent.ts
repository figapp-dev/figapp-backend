import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import {
  GDPR_CONSENT_TYPE,
  type GdprConsentRow,
} from "../types/gdpr-consent.js";

export async function listGdprConsentsForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: GdprConsentRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.GDPR_CONSENT)
    .select(
      "id, user_id, agency_id, consent_type, consent_given, consent_text, consent_version, legal_basis, consent_date, withdrawal_date, metadata",
    )
    .eq("user_id", userId)
    .eq("consent_type", GDPR_CONSENT_TYPE)
    .order("consent_date", { ascending: false });

  return {
    data: (data as GdprConsentRow[] | null) ?? [],
    error,
  };
}

export async function insertGdprConsent(
  supabase: SupabaseClient,
  row: {
    user_id: string;
    agency_id: string | null;
    consent_type: string;
    consent_given: boolean;
    consent_text: string;
    consent_version: string;
    legal_basis: string;
    metadata: Record<string, unknown>;
  },
): Promise<{ data: GdprConsentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.GDPR_CONSENT)
    .insert(row)
    .select(
      "id, user_id, agency_id, consent_type, consent_given, consent_text, consent_version, legal_basis, consent_date, withdrawal_date, metadata",
    )
    .single();

  return {
    data: (data as GdprConsentRow | null) ?? null,
    error,
  };
}

export async function withdrawGdprConsent(
  supabase: SupabaseClient,
  consentId: string,
  userId: string,
  reason: string,
): Promise<{ data: GdprConsentRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.GDPR_CONSENT)
    .update({
      consent_given: false,
      withdrawal_date: new Date().toISOString(),
      metadata: { withdrawal_reason: reason },
    })
    .eq("id", consentId)
    .eq("user_id", userId)
    .select(
      "id, user_id, agency_id, consent_type, consent_given, consent_text, consent_version, legal_basis, consent_date, withdrawal_date, metadata",
    )
    .single();

  return {
    data: (data as GdprConsentRow | null) ?? null,
    error,
  };
}

export async function findAgencyIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ data: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) return { data: null, error };
  const agencyId =
    data && typeof data === "object" && "agency_id" in data
      ? ((data as { agency_id: string | null }).agency_id ?? null)
      : null;
  return { data: agencyId, error: null };
}
