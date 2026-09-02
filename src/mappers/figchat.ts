import type { FigChatMessageDto, FigChatMessageRow } from "../types/figchat.js";

export function toFigChatMessageDto(row: FigChatMessageRow): FigChatMessageDto {
  return {
    id: row.id,
    conversationId: row.conversation_id,
    senderId: row.sender_id,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    attachmentUrl: row.attachment_url,
    attachmentType: row.attachment_type,
    attachmentName: row.attachment_name,
    attachmentSize: row.attachment_size,
  };
}
