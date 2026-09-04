import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  DEFAULT_SIGNED_URL_EXPIRES_SECONDS,
  STORAGE_BUCKETS,
} from "../../lib/storage.js";
import { toFigChatMessageDto } from "../../mappers/figchat.js";
import { createSignedDownloadUrl } from "../../repositories/files.js";
import {
  findAgencyIdForUser,
  findConversationType,
  findOwnParticipant,
  insertFigChatMessage,
  markConversationRead,
  touchConversation,
} from "../../repositories/figchat.js";
import { figChatConversationIdFromPath } from "../files/paths.js";
import type {
  FigChatMessageDto,
  SendFigChatMessageBody,
} from "../../types/figchat.js";

export async function sendFigChatMessageForUser(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
  body: SendFigChatMessageBody,
): Promise<
  | ReturnType<typeof serviceFailure>
  | ReturnType<typeof serviceSuccess<FigChatMessageDto>>
> {
  const content = body.content?.trim() || null;
  const attachment = body.attachment;
  if (!content && !attachment) {
    return serviceFailure({ badRequest: true });
  }

  const participant = await findOwnParticipant(supabase, conversationId, userId);
  if (participant.error) {
    return serviceFailure({ error: participant.error });
  }
  if (!participant.data || participant.data.archived) {
    return serviceFailure({ forbidden: true });
  }

  const conversation = await findConversationType(supabase, conversationId);
  if (conversation.error) {
    return serviceFailure({ error: conversation.error });
  }
  const conversationType = conversation.data?.type ?? null;
  if (conversationType === "broadcast_delivery") {
    // Delivery threads are written only by the server-side fan-out trigger —
    // matches the RLS policy's own NOT EXISTS(...'broadcast_delivery') check.
    const error = new Error(
      `FigChat send blocked: conversation ${conversationId} is type "broadcast_delivery" (sender=${userId})`,
    );
    error.name = "FigChatBroadcastDeliveryBlocked";
    return serviceFailure({ forbidden: true, error });
  }
  if (conversationType === "broadcast" && participant.data.role !== "admin") {
    // Broadcast hubs only accept sends from an admin participant — matches
    // is_conversation_admin(), which the RLS policy also enforces.
    const error = new Error(
      `FigChat send blocked: conversation ${conversationId} is type "broadcast" and sender ${userId} has role "${participant.data.role}", not admin`,
    );
    error.name = "FigChatBroadcastAdminOnly";
    return serviceFailure({ forbidden: true, error });
  }

  let attachmentUrl: string | null = null;
  let attachmentType: string | null = null;
  let attachmentName: string | null = null;
  let attachmentSize: number | null = null;

  if (attachment) {
    const path = attachment.path.trim();
    if (!path || figChatConversationIdFromPath(path) !== conversationId) {
      return serviceFailure({ forbidden: true });
    }

    // Web stores a signed URL directly in attachment_url (not a raw path),
    // and mobile must match that shared-column format exactly — see the
    // FigChat plan notes on why this isn't the raw-path-sign-on-read pattern
    // used for daily-log attachments. Known limitation: this link expires
    // after DEFAULT_SIGNED_URL_EXPIRES_SECONDS, same as web's.
    const signed = await createSignedDownloadUrl(
      supabase,
      STORAGE_BUCKETS.FIGCHAT,
      path,
      DEFAULT_SIGNED_URL_EXPIRES_SECONDS,
    );
    if (signed.error || !signed.data) {
      return serviceFailure({
        error: signed.error ?? new Error("Failed to sign attachment URL"),
      });
    }

    attachmentUrl = signed.data.signedUrl;
    attachmentType = attachment.contentType ?? null;
    attachmentName = attachment.name;
    attachmentSize = attachment.size ?? null;
  }

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) {
    return serviceFailure({ error: agency.error });
  }
  if (!agency.agencyId) {
    // Inserting with agency_id: null can never satisfy the
    // is_user_in_agency() RLS check, so this would always surface as an
    // opaque 42501 from Postgres. Fail fast with a clearer signal instead —
    // this means the sender has no (unarchived-or-not) agency_users row at
    // all, which is a data problem, not a filter mismatch.
    return serviceFailure({
      error: new Error(
        `FigChat send: no agency_users row found for sender ${userId}`,
      ),
    });
  }

  const inserted = await insertFigChatMessage(supabase, {
    conversation_id: conversationId,
    sender_id: userId,
    agency_id: agency.agencyId,
    // agency_fig_chat.content is NOT NULL — an attachment-only send has no
    // caption, so this must be "", not null. Matches web's own insert.
    content: content ?? "",
    attachment_url: attachmentUrl,
    attachment_type: attachmentType,
    attachment_name: attachmentName,
    attachment_size: attachmentSize,
  });
  if (inserted.error || !inserted.data) {
    return serviceFailure({
      error:
        inserted.error != null
          ? new Error(
              `${inserted.error.message} [conversationId=${conversationId} agencyId=${agency.agencyId} senderId=${userId}]`,
            )
          : new Error("Failed to insert message"),
    });
  }

  // Best-effort — a sender always considers their own message "read", and the
  // conversation's updated_at drives list-sort ordering. Neither should block
  // a successful send if they fail.
  const nowIso = new Date().toISOString();
  await Promise.all([
    touchConversation(supabase, conversationId, nowIso),
    markConversationRead(supabase, conversationId, userId, nowIso),
  ]);

  return serviceSuccess(toFigChatMessageDto(inserted.data));
}
