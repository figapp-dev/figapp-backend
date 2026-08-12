import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  DailyLogAssignmentDetailRow,
  DailyLogAssignmentListRow,
} from "../types/daily-logs.js";

export const ASSIGNMENT_LIST_SELECT = `
  id,
  assigned_date,
  status,
  assignment_subject,
  child_id,
  biological_parent_id,
  household_id,
  due_time,
  completed_at,
  daily_logs (
    id,
    status
  ),
  daily_log_templates:template_id (
    id,
    name
  )
`;

export const ASSIGNMENT_DETAIL_SELECT = `
  id,
  assigned_date,
  status,
  assignment_subject,
  child_id,
  biological_parent_id,
  household_id,
  due_time,
  completed_at,
  template_id,
  daily_logs (
    id,
    status,
    date,
    assignment_id,
    data_json,
    child_id,
    biological_parent_id,
    is_sensitive,
    updated_at
  ),
  daily_log_templates:template_id (
    id,
    name,
    template_fields
  )
`;

export type ContributorRow = {
  id: string;
  daily_log_id: string;
  contributor_id: string;
  contributed_at: string | null;
  last_edit_at: string;
};

export type AgencyUserNameRow = {
  user_id: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  figapp_id: string | null;
};

export type ChildNameRow = {
  id: string;
  legal_name: string | null;
  preferred_name: string | null;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
};

export type ParentNameRow = {
  id: string;
  name: string | null;
};

/** List assignments for households on a UK assigned date. */
export async function listAssignmentsByDate(
  supabase: SupabaseClient,
  householdIds: string[],
  assignedDate: string,
): Promise<{ data: DailyLogAssignmentListRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_LOG_ASSIGNMENTS)
    .select(ASSIGNMENT_LIST_SELECT)
    .in("household_id", householdIds)
    .eq("assigned_date", assignedDate)
    .order("assigned_date", { ascending: false });

  if (error) {
    return { data: [], error };
  }

  return {
    data: (data ?? []) as DailyLogAssignmentListRow[],
    error: null,
  };
}

/** Lean assignment row for access checks (e.g. file upload). */
export async function findAssignmentAccessForHouseholds(
  supabase: SupabaseClient,
  assignmentId: string,
  householdIds: string[],
): Promise<{
  data: {
    id: string;
    child_id: string | null;
    biological_parent_id: string | null;
    household_id: string | null;
  } | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_LOG_ASSIGNMENTS)
    .select("id, child_id, biological_parent_id, household_id")
    .eq("id", assignmentId)
    .in("household_id", householdIds)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: data as {
      id: string;
      child_id: string | null;
      biological_parent_id: string | null;
      household_id: string | null;
    } | null,
    error: null,
  };
}

/** Single assignment detail if it belongs to one of the household ids. */
export async function findAssignmentForHouseholds(
  supabase: SupabaseClient,
  assignmentId: string,
  householdIds: string[],
): Promise<{
  data: DailyLogAssignmentDetailRow | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_LOG_ASSIGNMENTS)
    .select(ASSIGNMENT_DETAIL_SELECT)
    .eq("id", assignmentId)
    .in("household_id", householdIds)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }

  return {
    data: (data as DailyLogAssignmentDetailRow | null) ?? null,
    error: null,
  };
}

export async function updateAssignment(
  supabase: SupabaseClient,
  assignmentId: string,
  payload: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.DAILY_LOG_ASSIGNMENTS)
    .update(payload)
    .eq("id", assignmentId);

  return { error };
}

export async function updateDailyLog(
  supabase: SupabaseClient,
  logId: string,
  payload: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.DAILY_LOGS)
    .update(payload)
    .eq("id", logId);

  return { error };
}

export async function insertDailyLog(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ id: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_LOGS)
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return { id: null, error };
  }

  return { id: (data?.id as string | undefined) ?? null, error: null };
}

export async function listContributorRows(
  supabase: SupabaseClient,
  logId: string,
): Promise<{ data: ContributorRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.DAILY_LOG_CONTRIBUTORS)
    .select("id, daily_log_id, contributor_id, contributed_at, last_edit_at")
    .eq("daily_log_id", logId)
    .order("last_edit_at", { ascending: false });

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as ContributorRow[], error: null };
}

export async function listAgencyUsersByUserIds(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<{ data: AgencyUserNameRow[]; error: Error | null }> {
  if (userIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("user_id, preferred_name, first_name, last_name, email, figapp_id")
    .in("user_id", userIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as AgencyUserNameRow[], error: null };
}

export async function upsertContributor(
  supabase: SupabaseClient,
  input: {
    dailyLogId: string;
    contributorId: string;
    contributionData: Record<string, unknown>;
    lastEditAt: string;
  },
): Promise<{ error: Error | null }> {
  const { error } = await supabase.from(TABLES.DAILY_LOG_CONTRIBUTORS).upsert(
    {
      daily_log_id: input.dailyLogId,
      contributor_id: input.contributorId,
      contribution_data: input.contributionData,
      last_edit_at: input.lastEditAt,
    },
    { onConflict: "daily_log_id,contributor_id" },
  );

  return { error };
}

export async function listChildrenNameRows(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{ data: ChildNameRow[]; error: Error | null }> {
  if (childIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select(
      "id, legal_name, preferred_name, first_name, middle_name, last_name",
    )
    .in("id", childIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as ChildNameRow[], error: null };
}

export async function listBiologicalParentNameRows(
  supabase: SupabaseClient,
  parentIds: string[],
): Promise<{ data: ParentNameRow[]; error: Error | null }> {
  if (parentIds.length === 0) {
    return { data: [], error: null };
  }

  const { data, error } = await supabase
    .from(TABLES.CHILD_BIOLOGICAL_PARENTS)
    .select("id, name")
    .in("id", parentIds);

  if (error) {
    return { data: [], error };
  }

  return { data: (data ?? []) as ParentNameRow[], error: null };
}
