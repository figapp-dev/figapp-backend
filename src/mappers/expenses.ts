import { STORAGE_BUCKETS } from "../lib/storage.js";
import type {
  ExpenseActivityRow,
  ExpenseAttachmentDto,
  ExpenseAttachmentRow,
  ExpenseClaimDetailDto,
  ExpenseClaimListItemDto,
  ExpenseClaimRow,
  ExpenseClaimStatus,
  ExpenseClaimsSummaryDto,
  ExpenseCommentDto,
  ExpensePersonDto,
} from "../types/expenses.js";

export function normalizeExpenseStatus(raw: string | null | undefined): ExpenseClaimStatus {
  const value = (raw ?? "new").trim().toLowerCase();
  if (value === "approved" || value === "declined" || value === "paid") {
    return value;
  }
  return "new";
}

export function expenseDisplayStatus(status: ExpenseClaimStatus): string {
  return status.toUpperCase();
}

export function canEditExpenseStatus(status: ExpenseClaimStatus): boolean {
  return status === "new" || status === "declined";
}

export function childDisplayName(child: {
  legal_name?: string | null;
  preferred_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null): string {
  if (!child) return "Child";
  const preferred = child.preferred_name?.trim();
  if (preferred) return preferred;
  const legal = child.legal_name?.trim();
  if (legal) return legal;
  const firstLast = [child.first_name, child.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return firstLast || "Child";
}

export function toExpensePersonFromChild(row: {
  id: string;
  figapp_id: string | null;
  legal_name: string | null;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
} | null): ExpensePersonDto | null {
  if (!row) return null;
  return {
    id: row.id,
    displayName: childDisplayName(row),
    figappId: row.figapp_id,
  };
}

export function toExpensePersonFromProfile(row: {
  user_id: string;
  figapp_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
} | null): ExpensePersonDto | null {
  if (!row) return null;
  const name = [row.first_name, row.last_name]
    .map((s) => s?.trim())
    .filter(Boolean)
    .join(" ");
  return {
    id: row.user_id,
    displayName: name || "Foster carer",
    figappId: row.figapp_id ?? null,
  };
}

export function toExpenseAttachmentDto(
  row: ExpenseAttachmentRow,
): ExpenseAttachmentDto {
  return {
    id: row.id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    fileType: row.file_type,
    bucket: STORAGE_BUCKETS.EXPENSE_ATTACHMENTS,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function toExpenseCommentDto(
  row: ExpenseActivityRow,
  authorName: string | null,
): ExpenseCommentDto {
  return {
    id: row.id,
    body: row.comment ?? "",
    activityType: row.activity_type,
    authorId: row.user_id,
    authorName,
    createdAt: row.created_at,
  };
}

export function toExpenseListItemDto(params: {
  row: ExpenseClaimRow;
  child: ExpensePersonDto | null;
  fosterCarer: ExpensePersonDto | null;
}): ExpenseClaimListItemDto {
  const status = normalizeExpenseStatus(params.row.status);
  return {
    id: params.row.id,
    expenseDate: params.row.expense_date,
    amount: Number(params.row.amount) || 0,
    description: params.row.description,
    status,
    displayStatus: expenseDisplayStatus(status),
    child: params.child,
    fosterCarer: params.fosterCarer,
    createdAt: params.row.created_at,
    updatedAt: params.row.updated_at,
    canEdit: canEditExpenseStatus(status),
  };
}

export function toExpenseDetailDto(params: {
  row: ExpenseClaimRow;
  child: ExpensePersonDto | null;
  fosterCarer: ExpensePersonDto | null;
  attachments: ExpenseAttachmentDto[];
  comments: ExpenseCommentDto[];
}): ExpenseClaimDetailDto {
  return {
    ...toExpenseListItemDto(params),
    agencyId: params.row.agency_id,
    rejectionReason: params.row.rejection_reason,
    reviewedAt: params.row.reviewed_at,
    paidAt: params.row.paid_at,
    attachments: params.attachments,
    comments: params.comments,
  };
}

export function buildExpenseSummary(
  rows: ExpenseClaimRow[],
): ExpenseClaimsSummaryDto {
  return {
    totalClaims: rows.length,
    newClaims: rows.filter((r) => normalizeExpenseStatus(r.status) === "new")
      .length,
    approvedClaims: rows.filter(
      (r) => normalizeExpenseStatus(r.status) === "approved",
    ).length,
    totalAmount: rows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0),
  };
}
