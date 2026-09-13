import { STORAGE_BUCKETS } from "../lib/storage.js";
import type {
  TicketAttachmentDto,
  TicketAttachmentRow,
  TicketDetailDto,
  TicketListItemDto,
  TicketMessageDto,
  TicketMessageRow,
  TicketPersonDto,
  TicketRow,
  TicketStatus,
} from "../types/tickets.js";

type ProfileLike = {
  user_id: string;
  first_name?: string | null;
  last_name?: string | null;
  role?: string | null;
  figapp_id?: string | null;
};

export function ticketDisplayStatus(status: string | null | undefined): string {
  switch (status) {
    case "open":
    case "in_progress":
      return "Open";
    case "resolved":
      return "Resolved";
    case "verified":
      return "Verified";
    case "closed":
      return "Closed";
    case "reopened":
      return "Reopened";
    default:
      return "Open";
  }
}

export function toTicketPersonDto(
  profile: ProfileLike | null | undefined,
  userId: string,
): TicketPersonDto | null {
  if (!profile && !userId) return null;
  return {
    userId: profile?.user_id ?? userId,
    firstName: profile?.first_name ?? null,
    lastName: profile?.last_name ?? null,
    role: profile?.role ?? null,
    figappId: profile?.figapp_id ?? null,
  };
}

export function toTicketAttachmentDto(
  row: TicketAttachmentRow,
): TicketAttachmentDto {
  return {
    id: row.id,
    fileName: row.file_name,
    fileSize: row.file_size,
    fileType: row.file_type,
    storagePath: row.storage_path,
    bucket: STORAGE_BUCKETS.ATTACHMENTS,
    uploadedBy: row.uploaded_by,
    createdAt: row.created_at,
  };
}

export function toTicketListItemDto(params: {
  row: TicketRow;
  messageCount: number;
  creator: TicketPersonDto | null;
}): TicketListItemDto {
  const status = (params.row.status ?? "open") as TicketStatus;
  return {
    id: params.row.id,
    subject: params.row.subject,
    description: params.row.description,
    priority: params.row.priority ?? "normal",
    status,
    displayStatus: ticketDisplayStatus(status),
    escalated: Boolean(params.row.escalated),
    ticketType: params.row.ticket_type ?? "general",
    messageCount: params.messageCount,
    createdAt: params.row.created_at,
    updatedAt: params.row.updated_at,
    creator: params.creator,
  };
}

export function toTicketMessageDto(params: {
  row: TicketMessageRow;
  author: TicketPersonDto | null;
  attachments: TicketAttachmentDto[];
}): TicketMessageDto {
  return {
    id: params.row.id,
    body: params.row.body,
    authorId: params.row.author_id,
    createdAt: params.row.created_at,
    author: params.author,
    attachments: params.attachments,
  };
}

export function toTicketDetailDto(params: {
  row: TicketRow;
  creator: TicketPersonDto | null;
  attachments: TicketAttachmentDto[];
  messages: TicketMessageDto[];
}): TicketDetailDto {
  const status = (params.row.status ?? "open") as TicketStatus;
  return {
    id: params.row.id,
    subject: params.row.subject,
    description: params.row.description,
    priority: params.row.priority ?? "normal",
    status,
    displayStatus: ticketDisplayStatus(status),
    escalated: Boolean(params.row.escalated),
    ticketType: params.row.ticket_type ?? "general",
    agencyId: params.row.agency_id,
    createdBy: params.row.created_by,
    assignedTo: params.row.assigned_to,
    createdAt: params.row.created_at,
    updatedAt: params.row.updated_at,
    resolvedAt: params.row.resolved_at,
    creator: params.creator,
    attachments: params.attachments,
    messages: params.messages,
  };
}
