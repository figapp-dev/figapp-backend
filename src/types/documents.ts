export type DocumentAssigneeRow = {
  id: string;
  document_id: string;
  user_id: string;
  status: string | null;
  has_read: boolean | null;
  read_at: string | null;
  signed_at: string | null;
  created_at?: string | null;
};

export type DocumentRow = {
  id: string;
  title: string | null;
  document_type: string | null;
  description: string | null;
  file_url: string | null;
  file_path: string | null;
  file_size_bytes: number | null;
  file_type: string | null;
  status: string | null;
  created_at: string | null;
  updated_at: string | null;
  agency_id: string | null;
  parent_document_id: string | null;
  owner_id: string | null;
  created_by: string | null;
  child_id: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
  completed_by_name: string | null;
  completed_by_figapp_id: string | null;
  completion_declaration: string | null;
  final_file_url: string | null;
  final_file_path: string | null;
  finalized_at: string | null;
  finalization_status: string | null;
  finalization_error: string | null;
};

export type DocumentAssigneeJoinRow = DocumentAssigneeRow & {
  documents: DocumentRow | DocumentRow[] | null;
};

export type DocumentAssignmentDto = {
  id: string;
  status: string;
  hasRead: boolean;
  readAt: string | null;
  signedAt: string | null;
};

export type DocumentListItemDto = {
  id: string;
  title: string;
  documentType: string | null;
  description: string | null;
  filePath: string | null;
  fileType: string | null;
  fileSizeBytes: number | null;
  /** Raw document.status */
  status: string | null;
  /** assigned | completed — matches web getDisplayStatus for carers */
  displayStatus: "assigned" | "completed";
  createdAt: string | null;
  updatedAt: string | null;
  childId: string | null;
  finalFilePath: string | null;
  finalizationStatus: string | null;
  /** Prefer final path for preview when present */
  previewPath: string | null;
  canSign: boolean;
  completedAt: string | null;
  completedByName: string | null;
  completedByFigappId: string | null;
  completionDeclaration: string | null;
  assignment: DocumentAssignmentDto;
};

export type DocumentListDto = {
  documents: DocumentListItemDto[];
  toReviewCount: number;
};

export type DocumentSignResultDto = {
  document: DocumentListItemDto;
  finalized: boolean;
  finalizationMessage: string | null;
};

export type SignDocumentBody = {
  hasRead: boolean;
};

export const STANDARD_DOCUMENT_DECLARATION =
  "I confirm that I have read, understood, and completed this document.";
