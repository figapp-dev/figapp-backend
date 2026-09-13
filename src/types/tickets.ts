export type TicketStatus =
  | "open"
  | "in_progress"
  | "resolved"
  | "verified"
  | "closed"
  | "reopened";

export type TicketPriority = "low" | "normal" | "high";

export type TicketListStatusFilter =
  | "open"
  | "resolved"
  | "verified"
  | "closed"
  | "reopened";

export type TicketPersonDto = {
  userId: string;
  firstName: string | null;
  lastName: string | null;
  role: string | null;
  figappId: string | null;
};

export type TicketAttachmentDto = {
  id: string;
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
  bucket: string;
  uploadedBy: string;
  createdAt: string | null;
};

export type TicketAttachmentInput = {
  fileName: string;
  fileSize: number;
  fileType: string;
  storagePath: string;
};

export type TicketListItemDto = {
  id: string;
  subject: string;
  description: string | null;
  priority: string;
  status: TicketStatus;
  displayStatus: string;
  escalated: boolean;
  ticketType: string;
  messageCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  creator: TicketPersonDto | null;
};

export type TicketListDto = {
  items: TicketListItemDto[];
};

export type TicketMessageDto = {
  id: string;
  body: string;
  authorId: string;
  createdAt: string | null;
  author: TicketPersonDto | null;
  attachments: TicketAttachmentDto[];
};

export type TicketDetailDto = {
  id: string;
  subject: string;
  description: string | null;
  priority: string;
  status: TicketStatus;
  displayStatus: string;
  escalated: boolean;
  ticketType: string;
  agencyId: string | null;
  createdBy: string;
  assignedTo: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  resolvedAt: string | null;
  creator: TicketPersonDto | null;
  attachments: TicketAttachmentDto[];
  messages: TicketMessageDto[];
};

export type CreateTicketBody = {
  subject: string;
  description?: string | null;
  priority?: TicketPriority | string;
  attachments?: TicketAttachmentInput[];
};

export type CreateTicketCommentBody = {
  body?: string | null;
  attachments?: TicketAttachmentInput[];
};

export type TicketRow = {
  id: string;
  agency_id: string | null;
  created_by: string;
  subject: string;
  description: string | null;
  priority: string | null;
  status: TicketStatus | string | null;
  escalated: boolean | null;
  ticket_type: string | null;
  assigned_to: string | null;
  source: string | null;
  created_at: string | null;
  updated_at: string | null;
  resolved_at: string | null;
};

export type TicketMessageRow = {
  id: string;
  ticket_id: string | null;
  author_id: string;
  body: string;
  created_at: string | null;
};

export type TicketAttachmentRow = {
  id: string;
  ticket_id: string;
  message_id: string | null;
  file_name: string;
  file_size: number;
  file_type: string;
  storage_path: string;
  uploaded_by: string;
  created_at: string | null;
};
