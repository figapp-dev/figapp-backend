import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  ExpenseActivityRow,
  ExpenseAttachmentInput,
  ExpenseAttachmentRow,
  ExpenseClaimRow,
  ExpenseClaimStatus,
} from "../types/expenses.js";

const CLAIM_FIELDS = `
  id,
  agency_id,
  child_id,
  foster_carer_id,
  amount,
  expense_date,
  description,
  status,
  rejection_reason,
  created_by,
  created_at,
  updated_at,
  reviewed_by,
  reviewed_at,
  paid_at
`;

const ATTACHMENT_FIELDS = `
  id,
  expense_claim_id,
  file_name,
  file_path,
  file_size,
  file_type,
  file_url,
  uploaded_by,
  created_at
`;

const ACTIVITY_FIELDS = `
  id,
  claim_id,
  user_id,
  activity_type,
  comment,
  created_at
`;

export async function listExpenseClaimsForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: ExpenseClaimStatus; q?: string },
): Promise<{ data: ExpenseClaimRow[]; error: Error | null }> {
  let query = supabase
    .from(TABLES.EXPENSE_CLAIMS)
    .select(CLAIM_FIELDS)
    .eq("foster_carer_id", userId)
    .order("created_at", { ascending: false });

  if (options?.status) {
    query = query.eq("status", options.status);
  }

  const { data, error } = await query;
  if (error) return { data: [], error };

  let rows = (data as ExpenseClaimRow[] | null) ?? [];
  const q = options?.q?.trim().toLowerCase();
  if (q) {
    // Child/carer name filtering applied after enrichment in service.
    rows = rows.filter((row) =>
      (row.description ?? "").toLowerCase().includes(q),
    );
  }

  return { data: rows, error: null };
}

export async function findExpenseClaimByIdForCarer(
  supabase: SupabaseClient,
  claimId: string,
  userId: string,
): Promise<{ data: ExpenseClaimRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIMS)
    .select(CLAIM_FIELDS)
    .eq("id", claimId)
    .eq("foster_carer_id", userId)
    .maybeSingle();

  return {
    data: (data as ExpenseClaimRow | null) ?? null,
    error,
  };
}

export async function insertExpenseClaim(
  supabase: SupabaseClient,
  input: {
    agencyId: string;
    childId: string;
    fosterCarerId: string;
    createdBy: string;
    amount: number;
    expenseDate: string;
    description: string | null;
  },
): Promise<{ data: ExpenseClaimRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIMS)
    .insert({
      agency_id: input.agencyId,
      child_id: input.childId,
      foster_carer_id: input.fosterCarerId,
      created_by: input.createdBy,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description,
      status: "new",
    })
    .select(CLAIM_FIELDS)
    .single();

  return {
    data: (data as ExpenseClaimRow | null) ?? null,
    error,
  };
}

export async function updateExpenseClaim(
  supabase: SupabaseClient,
  claimId: string,
  input: {
    childId: string;
    amount: number;
    expenseDate: string;
    description: string | null;
  },
): Promise<{ data: ExpenseClaimRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIMS)
    .update({
      child_id: input.childId,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description,
      updated_at: new Date().toISOString(),
    })
    .eq("id", claimId)
    .select(CLAIM_FIELDS)
    .single();

  return {
    data: (data as ExpenseClaimRow | null) ?? null,
    error,
  };
}

export async function listAttachmentsForClaims(
  supabase: SupabaseClient,
  claimIds: string[],
): Promise<{ data: ExpenseAttachmentRow[]; error: Error | null }> {
  if (claimIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIM_ATTACHMENTS)
    .select(ATTACHMENT_FIELDS)
    .in("expense_claim_id", claimIds)
    .order("created_at", { ascending: true });

  return {
    data: ((data as ExpenseAttachmentRow[] | null) ?? []),
    error,
  };
}

export async function findExpenseAttachmentByPath(
  supabase: SupabaseClient,
  path: string,
): Promise<{ data: ExpenseAttachmentRow | null; error: Error | null }> {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized) return { data: null, error: null };
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIM_ATTACHMENTS)
    .select(ATTACHMENT_FIELDS)
    .eq("file_path", normalized)
    .limit(1)
    .maybeSingle();

  return {
    data: (data as ExpenseAttachmentRow | null) ?? null,
    error,
  };
}

export async function insertExpenseAttachments(
  supabase: SupabaseClient,
  claimId: string,
  uploadedBy: string,
  files: ExpenseAttachmentInput[],
): Promise<{ error: Error | null }> {
  if (files.length === 0) return { error: null };
  const { error } = await supabase.from(TABLES.EXPENSE_CLAIM_ATTACHMENTS).insert(
    files.map((file) => ({
      expense_claim_id: claimId,
      file_name: file.fileName,
      file_path: file.storagePath,
      file_url: file.storagePath,
      file_size: file.fileSize,
      file_type: file.fileType,
      uploaded_by: uploadedBy,
    })),
  );
  return { error };
}

export async function listCommentsForClaim(
  supabase: SupabaseClient,
  claimId: string,
): Promise<{ data: ExpenseActivityRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIM_ACTIVITIES)
    .select(ACTIVITY_FIELDS)
    .eq("claim_id", claimId)
    .eq("activity_type", "comment")
    .order("created_at", { ascending: true });

  return {
    data: ((data as ExpenseActivityRow[] | null) ?? []),
    error,
  };
}

export async function insertExpenseComment(
  supabase: SupabaseClient,
  input: { claimId: string; userId: string; body: string },
): Promise<{ data: ExpenseActivityRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.EXPENSE_CLAIM_ACTIVITIES)
    .insert({
      claim_id: input.claimId,
      user_id: input.userId,
      activity_type: "comment",
      comment: input.body,
    })
    .select(ACTIVITY_FIELDS)
    .single();

  return {
    data: (data as ExpenseActivityRow | null) ?? null,
    error,
  };
}

export async function listChildrenByIds(
  supabase: SupabaseClient,
  childIds: string[],
): Promise<{
  data: Array<{
    id: string;
    figapp_id: string | null;
    legal_name: string | null;
    preferred_name: string | null;
    first_name: string | null;
    last_name: string | null;
  }>;
  error: Error | null;
}> {
  if (childIds.length === 0) return { data: [], error: null };
  const { data, error } = await supabase
    .from(TABLES.CHILDREN)
    .select("id, figapp_id, legal_name, preferred_name, first_name, last_name")
    .in("id", childIds);

  return {
    data: (data as Array<{
      id: string;
      figapp_id: string | null;
      legal_name: string | null;
      preferred_name: string | null;
      first_name: string | null;
      last_name: string | null;
    }> | null) ?? [],
    error,
  };
}
