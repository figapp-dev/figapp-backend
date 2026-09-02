export type FigChatMessageRow = {
  id: string;
  agency_id: string | null;
  sender_id: string | null;
  content: string | null;
  created_at: string | null;
  updated_at: string | null;
  conversation_id: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name: string | null;
  attachment_size: number | null;
  is_deleted: boolean | null;
};

export type FigChatMessageDto = {
  id: string;
  conversationId: string;
  senderId: string | null;
  content: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  attachmentUrl: string | null;
  attachmentType: string | null;
  attachmentName: string | null;
  attachmentSize: number | null;
};

export type ConversationParticipantRow = {
  id: string;
  conversation_id: string;
  user_id: string;
  role: string | null;
  last_read_at: string | null;
  archived: boolean | null;
};

/** `attachment.path` must come from a prior POST /files/signed-upload-url
 * call with resource "figchat" for this same conversation — the service
 * verifies the path's conversation-id prefix before signing a download URL
 * for it, so a client can't reference another conversation's file. */
export type SendFigChatMessageBody = {
  content?: string;
  attachment?: {
    path: string;
    name: string;
    contentType?: string;
    size?: number;
  };
};
