import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { findOwnParticipant, markConversationRead } from "../../repositories/figchat.js";

export async function markFigChatConversationReadForUser(
  supabase: SupabaseClient,
  userId: string,
  conversationId: string,
): Promise<
  ReturnType<typeof serviceFailure> | ReturnType<typeof serviceSuccess<{ ok: true }>>
> {
  const participant = await findOwnParticipant(supabase, conversationId, userId);
  if (participant.error) {
    return serviceFailure({ error: participant.error });
  }
  if (!participant.data) {
    return serviceFailure({ forbidden: true });
  }

  const { error } = await markConversationRead(
    supabase,
    conversationId,
    userId,
    new Date().toISOString(),
  );
  if (error) {
    return serviceFailure({ error });
  }

  return serviceSuccess({ ok: true as const });
}
