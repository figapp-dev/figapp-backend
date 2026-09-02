import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  ConversationParticipantRow,
  FigChatMessageRow,
} from "../types/figchat.js";

export async function findAgencyIdForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ agencyId: string | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("agency_id")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    return { agencyId: null, error };
  }
  return {
    agencyId: (data as { agency_id: string | null } | null)?.agency_id ?? null,
    error: null,
  };
}

/** The caller's own participant row for a conversation, or null if they are
 * not an (active) participant — RLS would already block a non-participant's
 * read here, but this also distinguishes "not a member" from "archived". */
export async function findOwnParticipant(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
): Promise<{ data: ConversationParticipantRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.CONVERSATION_PARTICIPANTS)
    .select("id, conversation_id, user_id, role, last_read_at, archived")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { data: null, error };
  }
  return { data: (data as ConversationParticipantRow | null) ?? null, error: null };
}

export async function insertFigChatMessage(
  supabase: SupabaseClient,
  row: {
    conversation_id: string;
    sender_id: string;
    agency_id: string | null;
    content: string | null;
    attachment_url?: string | null;
    attachment_type?: string | null;
    attachment_name?: string | null;
    attachment_size?: number | null;
  },
): Promise<{ data: FigChatMessageRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_FIG_CHAT)
    .insert(row)
    .select(
      "id, agency_id, sender_id, content, created_at, updated_at, conversation_id, attachment_url, attachment_type, attachment_name, attachment_size, is_deleted",
    )
    .single();

  if (error) {
    return { data: null, error };
  }
  return { data: data as FigChatMessageRow, error: null };
}

export async function touchConversation(
  supabase: SupabaseClient,
  conversationId: string,
  nowIso: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.CONVERSATIONS)
    .update({ updated_at: nowIso })
    .eq("id", conversationId);
  return { error };
}

export async function markConversationRead(
  supabase: SupabaseClient,
  conversationId: string,
  userId: string,
  nowIso: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.CONVERSATION_PARTICIPANTS)
    .update({ last_read_at: nowIso })
    .eq("conversation_id", conversationId)
    .eq("user_id", userId);
  return { error };
}
