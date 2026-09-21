import type { SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { STORAGE_BUCKETS } from "../../lib/storage.js";
import {
  toTicketAttachmentDto,
  toTicketDetailDto,
  toTicketListItemDto,
  toTicketMessageDto,
  toTicketPersonDto,
} from "../../mappers/tickets.js";
import { findAgencyIdForUser } from "../../repositories/figchat.js";
import { listCarerDetailProfilesByUserIds } from "../../repositories/households.js";
import {
  countMessagesByTicketIds,
  findTicketByIdForCreator,
  insertTicket,
  insertTicketAttachments,
  insertTicketMessage,
  listAttachmentsForTicket,
  listMessagesForTicket,
  listTicketsForCreator,
  touchTicketUpdatedAt,
} from "../../repositories/tickets.js";
import type {
  CreateTicketBody,
  CreateTicketCommentBody,
  TicketAttachmentInput,
  TicketDetailDto,
  TicketListDto,
  TicketListStatusFilter,
  TicketMessageDto,
  TicketPriority,
} from "../../types/tickets.js";
import { notifyTicketComment, notifyTicketCreated } from "./notify.js";

const MAX_CREATE_ATTACHMENTS = 5;
const MAX_COMMENT_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
const ALLOWED_PRIORITIES = new Set<TicketPriority>(["low", "normal", "high"]);

function normalizePriority(raw: string | undefined | null): TicketPriority {
  const value = (raw ?? "normal").trim().toLowerCase();
  if (ALLOWED_PRIORITIES.has(value as TicketPriority)) {
    return value as TicketPriority;
  }
  return "normal";
}

function normalizeAttachmentInputs(
  files: TicketAttachmentInput[] | undefined,
  userId: string,
  maxCount: number,
): { files: TicketAttachmentInput[]; badRequest: boolean } {
  if (!files || files.length === 0) return { files: [], badRequest: false };
  if (files.length > maxCount) return { files: [], badRequest: true };

  const normalized: TicketAttachmentInput[] = [];
  for (const file of files) {
    const fileName = file.fileName?.trim() ?? "";
    const storagePath = file.storagePath?.trim().replace(/^\/+/, "") ?? "";
    const fileType = file.fileType?.trim() || "application/octet-stream";
    const fileSize =
      typeof file.fileSize === "number" && Number.isFinite(file.fileSize)
        ? Math.max(0, Math.floor(file.fileSize))
        : 0;

    if (!fileName || !storagePath) {
      return { files: [], badRequest: true };
    }
    if (!storagePath.startsWith(`${userId}/`)) {
      return { files: [], badRequest: true };
    }
    if (fileSize > MAX_ATTACHMENT_BYTES) {
      return { files: [], badRequest: true };
    }

    normalized.push({
      fileName,
      fileSize,
      fileType,
      storagePath,
    });
  }

  return { files: normalized, badRequest: false };
}

async function loadPersonMap(
  supabase: SupabaseClient,
  userIds: string[],
) {
  const unique = [...new Set(userIds.filter(Boolean))];
  const { data, error } = await listCarerDetailProfilesByUserIds(
    supabase,
    unique,
  );
  if (error) return { map: new Map<string, ReturnType<typeof toTicketPersonDto>>(), error };

  const map = new Map(
    data.map((profile) => [
      profile.user_id,
      toTicketPersonDto(profile, profile.user_id),
    ]),
  );
  return { map, error: null };
}

export async function listTicketsForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: TicketListStatusFilter; q?: string },
) {
  const { data, error } = await listTicketsForCreator(supabase, userId, options);
  if (error) return serviceFailure({ error });

  const ticketIds = data.map((row) => row.id);
  const counts = await countMessagesByTicketIds(supabase, ticketIds);
  if (counts.error) return serviceFailure({ error: counts.error });

  const people = await loadPersonMap(
    supabase,
    data.map((row) => row.created_by),
  );
  if (people.error) return serviceFailure({ error: people.error });

  const items = data.map((row) =>
    toTicketListItemDto({
      row,
      messageCount: counts.data.get(row.id) ?? 0,
      creator: people.map.get(row.created_by) ?? toTicketPersonDto(null, row.created_by),
    }),
  );

  return serviceSuccess<TicketListDto>({ items });
}

export async function getTicketForCarer(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
) {
  const id = ticketId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const { data: row, error } = await findTicketByIdForCreator(
    supabase,
    id,
    userId,
  );
  if (error) return serviceFailure({ error });
  if (!row) return serviceFailure({ notFound: true });

  const [messages, attachments] = await Promise.all([
    listMessagesForTicket(supabase, id),
    listAttachmentsForTicket(supabase, id),
  ]);
  if (messages.error) return serviceFailure({ error: messages.error });
  if (attachments.error) return serviceFailure({ error: attachments.error });

  const allPeople = await loadPersonMap(supabase, [
    row.created_by,
    ...messages.data.map((m) => m.author_id),
  ]);
  if (allPeople.error) return serviceFailure({ error: allPeople.error });

  const ticketAttachments = attachments.data
    .filter((a) => a.message_id == null)
    .map(toTicketAttachmentDto);

  const messageDtos: TicketMessageDto[] = messages.data.map((message) => {
    const messageAttachments = attachments.data
      .filter((a) => a.message_id === message.id)
      .map(toTicketAttachmentDto);
    return toTicketMessageDto({
      row: message,
      author:
        allPeople.map.get(message.author_id) ??
        toTicketPersonDto(null, message.author_id),
      attachments: messageAttachments,
    });
  });

  return serviceSuccess<TicketDetailDto>(
    toTicketDetailDto({
      row,
      creator:
        allPeople.map.get(row.created_by) ??
        toTicketPersonDto(null, row.created_by),
      attachments: ticketAttachments,
      messages: messageDtos,
    }),
  );
}

export async function createTicketForCarer(
  supabase: SupabaseClient,
  userId: string,
  body: CreateTicketBody,
) {
  const subject = body.subject?.trim() ?? "";
  if (!subject) return serviceFailure({ badRequest: true });

  const description = body.description?.trim() || null;
  const priority = normalizePriority(body.priority);
  const attachments = normalizeAttachmentInputs(
    body.attachments,
    userId,
    MAX_CREATE_ATTACHMENTS,
  );
  if (attachments.badRequest) return serviceFailure({ badRequest: true });

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) return serviceFailure({ error: agency.error });
  if (!agency.agencyId) {
    return serviceFailure({
      badRequest: true,
      error: new Error("agency"),
    });
  }

  const { data: row, error } = await insertTicket(supabase, {
    agencyId: agency.agencyId,
    createdBy: userId,
    subject,
    description,
    priority,
  });
  if (error || !row) {
    return serviceFailure({
      error: error ?? new Error("Failed to create ticket"),
    });
  }

  if (attachments.files.length > 0) {
    const attachResult = await insertTicketAttachments(
      supabase,
      attachments.files.map((file) => ({
        ticketId: row.id,
        messageId: null,
        uploadedBy: userId,
        file,
      })),
    );
    if (attachResult.error) {
      return serviceFailure({ error: attachResult.error });
    }
  }

  // Fire-and-forget: same edge function the web uses. Must not block create.
  void notifyTicketCreated(supabase, row);

  return getTicketForCarer(supabase, userId, row.id);
}

export async function addTicketCommentForCarer(
  supabase: SupabaseClient,
  userId: string,
  ticketId: string,
  body: CreateTicketCommentBody,
) {
  const id = ticketId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const { data: ticket, error: ticketError } = await findTicketByIdForCreator(
    supabase,
    id,
    userId,
  );
  if (ticketError) return serviceFailure({ error: ticketError });
  if (!ticket) return serviceFailure({ notFound: true });

  const attachments = normalizeAttachmentInputs(
    body.attachments,
    userId,
    MAX_COMMENT_ATTACHMENTS,
  );
  if (attachments.badRequest) return serviceFailure({ badRequest: true });

  const text = body.body?.trim() ?? "";
  if (!text && attachments.files.length === 0) {
    return serviceFailure({ badRequest: true });
  }
  const messageBody = text || "[Attachment]";

  const { data: message, error: messageError } = await insertTicketMessage(
    supabase,
    {
      ticketId: id,
      authorId: userId,
      body: messageBody,
    },
  );
  if (messageError || !message) {
    return serviceFailure({
      error: messageError ?? new Error("Failed to create ticket comment"),
    });
  }

  if (attachments.files.length > 0) {
    const attachResult = await insertTicketAttachments(
      supabase,
      attachments.files.map((file) => ({
        ticketId: id,
        messageId: message.id,
        uploadedBy: userId,
        file,
      })),
    );
    if (attachResult.error) {
      return serviceFailure({ error: attachResult.error });
    }
  }

  await touchTicketUpdatedAt(supabase, id);

  // Fire-and-forget: notifies other participants (assignee / creator / thread).
  void notifyTicketComment(supabase, message);

  return getTicketForCarer(supabase, userId, id);
}

export function buildTicketAttachmentStoragePath(options: {
  userId: string;
  fileName: string;
}) {
  const safe = options.fileName.trim().replace(/[/\\]/g, "_") || "upload.bin";
  return `${options.userId}/${randomUUID()}_${safe}`;
}

export { STORAGE_BUCKETS };
