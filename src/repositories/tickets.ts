import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  TicketAttachmentInput,
  TicketAttachmentRow,
  TicketListStatusFilter,
  TicketMessageRow,
  TicketRow,
} from "../types/tickets.js";

const TICKET_FIELDS = `
  id,
  agency_id,
  created_by,
  subject,
  description,
  priority,
  status,
  escalated,
  ticket_type,
  assigned_to,
  source,
  created_at,
  updated_at,
  resolved_at
`;

const MESSAGE_FIELDS = `
  id,
  ticket_id,
  author_id,
  body,
  created_at
`;

const ATTACHMENT_FIELDS = `
  id,
  ticket_id,
  message_id,
  file_name,
  file_size,
  file_type,
  storage_path,
  uploaded_by,
  created_at
`;

const OPEN_STATUSES = ["open", "in_progress"];

function statusesForFilter(status?: TicketListStatusFilter): string[] | null {
  if (!status) return null;
  if (status === "open") return OPEN_STATUSES;
  return [status];
}

export async function listTicketsForCreator(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: TicketListStatusFilter; q?: string },
): Promise<{ data: TicketRow[]; error: Error | null }> {
  let query = supabase
    .from(TABLES.TICKETS)
    .select(TICKET_FIELDS)
    .eq("created_by", userId)
    .order("updated_at", { ascending: false });

  const statuses = statusesForFilter(options?.status);
  if (statuses) {
    query = query.in("status", statuses);
  }

  const q = options?.q?.trim();
  if (q) {
    const escaped = q.replace(/[%_,]/g, "");
    if (escaped) {
      query = query.or(
        `subject.ilike.%${escaped}%,description.ilike.%${escaped}%`,
      );
    }
  }

  const { data, error } = await query;
  return {
    data: ((data as TicketRow[] | null) ?? []),
    error,
  };
}

export async function findTicketByIdForCreator(
  supabase: SupabaseClient,
  ticketId: string,
  userId: string,
): Promise<{ data: TicketRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TICKETS)
    .select(TICKET_FIELDS)
    .eq("id", ticketId)
    .eq("created_by", userId)
    .maybeSingle();

  return {
    data: (data as TicketRow | null) ?? null,
    error,
  };
}

export async function insertTicket(
  supabase: SupabaseClient,
  input: {
    agencyId: string;
    createdBy: string;
    subject: string;
    description: string | null;
    priority: string;
  },
): Promise<{ data: TicketRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TICKETS)
    .insert({
      agency_id: input.agencyId,
      created_by: input.createdBy,
      subject: input.subject,
      description: input.description,
      priority: input.priority,
      status: "open",
      ticket_type: "general",
      source: "manual",
      escalated: false,
    })
    .select(TICKET_FIELDS)
    .single();

  return {
    data: (data as TicketRow | null) ?? null,
    error,
  };
}

export async function listMessagesForTicket(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<{ data: TicketMessageRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TICKET_MESSAGES)
    .select(MESSAGE_FIELDS)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return {
    data: ((data as TicketMessageRow[] | null) ?? []),
    error,
  };
}

export async function countMessagesByTicketIds(
  supabase: SupabaseClient,
  ticketIds: string[],
): Promise<{ data: Map<string, number>; error: Error | null }> {
  const counts = new Map<string, number>();
  if (ticketIds.length === 0) return { data: counts, error: null };

  const { data, error } = await supabase
    .from(TABLES.TICKET_MESSAGES)
    .select("ticket_id")
    .in("ticket_id", ticketIds);

  if (error) return { data: counts, error };

  for (const row of (data as { ticket_id: string | null }[] | null) ?? []) {
    if (!row.ticket_id) continue;
    counts.set(row.ticket_id, (counts.get(row.ticket_id) ?? 0) + 1);
  }

  return { data: counts, error: null };
}

export async function listAttachmentsForTicket(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<{ data: TicketAttachmentRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TICKET_ATTACHMENTS)
    .select(ATTACHMENT_FIELDS)
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  return {
    data: ((data as TicketAttachmentRow[] | null) ?? []),
    error,
  };
}

export async function findTicketAttachmentByPath(
  supabase: SupabaseClient,
  path: string,
): Promise<{ data: TicketAttachmentRow | null; error: Error | null }> {
  const normalized = path.trim().replace(/^\/+/, "");
  if (!normalized) return { data: null, error: null };

  const { data, error } = await supabase
    .from(TABLES.TICKET_ATTACHMENTS)
    .select(ATTACHMENT_FIELDS)
    .eq("storage_path", normalized)
    .limit(1)
    .maybeSingle();

  return {
    data: (data as TicketAttachmentRow | null) ?? null,
    error,
  };
}

export async function insertTicketAttachments(
  supabase: SupabaseClient,
  rows: Array<{
    ticketId: string;
    messageId: string | null;
    uploadedBy: string;
    file: TicketAttachmentInput;
  }>,
): Promise<{ error: Error | null }> {
  if (rows.length === 0) return { error: null };

  const { error } = await supabase.from(TABLES.TICKET_ATTACHMENTS).insert(
    rows.map((row) => ({
      ticket_id: row.ticketId,
      message_id: row.messageId,
      uploaded_by: row.uploadedBy,
      file_name: row.file.fileName,
      file_size: row.file.fileSize,
      file_type: row.file.fileType,
      storage_path: row.file.storagePath,
    })),
  );

  return { error };
}

export async function insertTicketMessage(
  supabase: SupabaseClient,
  input: {
    ticketId: string;
    authorId: string;
    body: string;
  },
): Promise<{ data: TicketMessageRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.TICKET_MESSAGES)
    .insert({
      ticket_id: input.ticketId,
      author_id: input.authorId,
      body: input.body,
    })
    .select(MESSAGE_FIELDS)
    .single();

  return {
    data: (data as TicketMessageRow | null) ?? null,
    error,
  };
}

export async function touchTicketUpdatedAt(
  supabase: SupabaseClient,
  ticketId: string,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from(TABLES.TICKETS)
    .update({ updated_at: new Date().toISOString() })
    .eq("id", ticketId);

  return { error };
}
