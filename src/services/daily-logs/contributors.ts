import type { SupabaseClient } from "@supabase/supabase-js";
import {
  listAgencyUsersByUserIds,
  listContributorRows,
  upsertContributor,
  type AgencyUserNameRow,
} from "../../repositories/daily-logs.js";
import type { DailyLogContributorDto } from "../../types/daily-logs.js";

function displayNameFromAgencyUser(row: AgencyUserNameRow): string | null {
  const preferred = String(row.preferred_name ?? "").trim();
  if (preferred) return preferred;
  const full = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim();
  if (full) return full;
  const email = String(row.email ?? "").trim();
  if (email) return email;
  const figId = String(row.figapp_id ?? "").trim();
  if (figId) return figId;
  return null;
}

/** Load contributors and resolve display names (business-facing DTO). */
export async function loadContributorsForLog(
  supabase: SupabaseClient,
  logId: string,
): Promise<{ data: DailyLogContributorDto[]; error: Error | null }> {
  const { data: rows, error } = await listContributorRows(supabase, logId);
  if (error) {
    return { data: [], error };
  }
  if (rows.length === 0) {
    return { data: [], error: null };
  }

  const contributorIds = [
    ...new Set(rows.map((row) => row.contributor_id).filter(Boolean)),
  ];

  const { data: agencyRows, error: agencyError } =
    await listAgencyUsersByUserIds(supabase, contributorIds);
  if (agencyError) {
    return { data: [], error: agencyError };
  }

  const nameByUserId = new Map<string, string>();
  for (const agency of agencyRows) {
    if (!agency.user_id || nameByUserId.has(agency.user_id)) continue;
    const name = displayNameFromAgencyUser(agency);
    if (name) nameByUserId.set(agency.user_id, name);
  }

  return {
    data: rows.map((row) => ({
      id: row.id,
      contributorId: row.contributor_id,
      displayName: nameByUserId.get(row.contributor_id) ?? "Unknown user",
      contributedAt: row.contributed_at,
      lastEditAt: row.last_edit_at,
    })),
    error: null,
  };
}

/** Best-effort (matches web: don't block save if this fails). */
export async function upsertContributorForSave(
  supabase: SupabaseClient,
  logId: string,
  userId: string,
  dataJson: Record<string, unknown>,
  lastEditAt: string,
): Promise<Error | null> {
  const { error } = await upsertContributor(supabase, {
    dailyLogId: logId,
    contributorId: userId,
    contributionData: dataJson,
    lastEditAt,
  });
  return error;
}
