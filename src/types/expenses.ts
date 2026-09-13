export type ExpenseClaimStatus = "new" | "approved" | "declined" | "paid";

export type ExpensePersonDto = {
  id: string;
  displayName: string;
  figappId: string | null;
};

export type ExpenseAttachmentDto = {
  id: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileType: string;
  bucket: string;
  uploadedBy: string;
  createdAt: string | null;
};

export type ExpenseCommentDto = {
  id: string;
  body: string;
  activityType: string;
  authorId: string;
  authorName: string | null;
  createdAt: string | null;
};

export type ExpenseAttachmentInput = {
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
};

export type ExpenseClaimListItemDto = {
  id: string;
  expenseDate: string;
  amount: number;
  description: string | null;
  status: ExpenseClaimStatus;
  displayStatus: string;
  child: ExpensePersonDto | null;
  fosterCarer: ExpensePersonDto | null;
  createdAt: string;
  updatedAt: string;
  canEdit: boolean;
};

export type ExpenseClaimsSummaryDto = {
  totalClaims: number;
  newClaims: number;
  approvedClaims: number;
  totalAmount: number;
};

export type ExpenseClaimsListDto = {
  items: ExpenseClaimListItemDto[];
  summary: ExpenseClaimsSummaryDto;
};

export type ExpenseClaimDetailDto = ExpenseClaimListItemDto & {
  agencyId: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
  paidAt: string | null;
  attachments: ExpenseAttachmentDto[];
  comments: ExpenseCommentDto[];
};

export type CreateExpenseClaimBody = {
  childId: string;
  expenseDate: string;
  amount: number;
  description?: string | null;
  attachments?: ExpenseAttachmentInput[];
};

export type UpdateExpenseClaimBody = {
  childId?: string;
  expenseDate?: string;
  amount?: number;
  description?: string | null;
  attachments?: ExpenseAttachmentInput[];
};

export type CreateExpenseCommentBody = {
  body: string;
};

export type ExpenseClaimRow = {
  id: string;
  agency_id: string;
  child_id: string;
  foster_carer_id: string;
  amount: number;
  expense_date: string;
  description: string | null;
  status: string;
  rejection_reason: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  paid_at: string | null;
};

export type ExpenseAttachmentRow = {
  id: string;
  expense_claim_id: string;
  file_name: string;
  file_path: string;
  file_size: number;
  file_type: string;
  file_url: string | null;
  uploaded_by: string;
  created_at: string;
};

export type ExpenseActivityRow = {
  id: string;
  claim_id: string;
  user_id: string;
  activity_type: string;
  comment: string | null;
  created_at: string | null;
};
