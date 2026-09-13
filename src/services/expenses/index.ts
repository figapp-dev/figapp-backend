import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import { getActiveHouseholdIds } from "../../lib/households.js";
import {
  buildExpenseSummary,
  toExpenseAttachmentDto,
  toExpenseCommentDto,
  toExpenseDetailDto,
  toExpenseListItemDto,
  toExpensePersonFromChild,
  toExpensePersonFromProfile,
} from "../../mappers/expenses.js";
import { listCarerDetailProfilesByUserIds } from "../../repositories/households.js";
import { findAgencyIdForUser } from "../../repositories/figchat.js";
import {
  findExpenseClaimByIdForCarer,
  insertExpenseAttachments,
  insertExpenseClaim,
  insertExpenseComment,
  listAttachmentsForClaims,
  listChildrenByIds,
  listCommentsForClaim,
  listExpenseClaimsForCarer,
  updateExpenseClaim,
} from "../../repositories/expenses.js";
import { assertChildAccessibleToCarer } from "../children/shared.js";
import type {
  CreateExpenseClaimBody,
  CreateExpenseCommentBody,
  ExpenseAttachmentInput,
  ExpenseClaimDetailDto,
  ExpenseClaimStatus,
  ExpenseClaimsListDto,
  UpdateExpenseClaimBody,
} from "../../types/expenses.js";

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

function normalizeAttachments(
  files: ExpenseAttachmentInput[] | undefined,
  userId: string,
): { files: ExpenseAttachmentInput[]; badRequest: boolean } {
  if (!files || files.length === 0) return { files: [], badRequest: false };
  if (files.length > MAX_ATTACHMENTS) return { files: [], badRequest: true };

  const normalized: ExpenseAttachmentInput[] = [];
  for (const file of files) {
    const fileName = file.fileName?.trim() ?? "";
    const storagePath = file.storagePath?.trim().replace(/^\/+/, "") ?? "";
    const fileType = file.fileType?.trim() || "application/octet-stream";
    const fileSize =
      typeof file.fileSize === "number" && Number.isFinite(file.fileSize)
        ? Math.max(0, Math.floor(file.fileSize))
        : 0;
    if (!fileName || !storagePath) return { files: [], badRequest: true };
    if (!storagePath.startsWith(`${userId}/`)) {
      return { files: [], badRequest: true };
    }
    if (fileSize > MAX_ATTACHMENT_BYTES) return { files: [], badRequest: true };
    normalized.push({ fileName, fileSize, fileType, storagePath });
  }
  return { files: normalized, badRequest: false };
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(value) && !Number.isNaN(Date.parse(value));
}

async function enrichClaims(
  supabase: SupabaseClient,
  rows: Awaited<ReturnType<typeof listExpenseClaimsForCarer>>["data"],
) {
  const childIds = [...new Set(rows.map((r) => r.child_id))];
  const carerIds = [...new Set(rows.map((r) => r.foster_carer_id))];

  const [children, carers] = await Promise.all([
    listChildrenByIds(supabase, childIds),
    listCarerDetailProfilesByUserIds(supabase, carerIds),
  ]);
  if (children.error) return { error: children.error, items: null };
  if (carers.error) return { error: carers.error, items: null };

  const childrenById = new Map(children.data.map((c) => [c.id, c]));
  const carersById = new Map(carers.data.map((c) => [c.user_id, c]));

  const items = rows.map((row) =>
    toExpenseListItemDto({
      row,
      child: toExpensePersonFromChild(childrenById.get(row.child_id) ?? null),
      fosterCarer: toExpensePersonFromProfile(
        carersById.get(row.foster_carer_id) ?? null,
      ),
    }),
  );

  return { error: null, items };
}

export async function listExpensesForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: ExpenseClaimStatus; q?: string },
) {
  // Load all for summary; filter afterward for items if needed.
  const all = await listExpenseClaimsForCarer(supabase, userId);
  if (all.error) return serviceFailure({ error: all.error });

  const summary = buildExpenseSummary(all.data);
  let rows = all.data;
  if (options?.status) {
    rows = rows.filter((r) => r.status === options.status);
  }

  const enriched = await enrichClaims(supabase, rows);
  if (enriched.error || !enriched.items) {
    return serviceFailure({ error: enriched.error });
  }

  let items = enriched.items;
  const q = options?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) => {
      const haystack = [
        item.description ?? "",
        item.child?.displayName ?? "",
        item.child?.figappId ?? "",
        item.fosterCarer?.displayName ?? "",
        item.fosterCarer?.figappId ?? "",
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }

  return serviceSuccess<ExpenseClaimsListDto>({ items, summary });
}

export async function getExpenseForCarer(
  supabase: SupabaseClient,
  userId: string,
  claimId: string,
) {
  const id = claimId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const claim = await findExpenseClaimByIdForCarer(supabase, id, userId);
  if (claim.error) return serviceFailure({ error: claim.error });
  if (!claim.data) return serviceFailure({ notFound: true });

  const [children, carers, attachments, comments] = await Promise.all([
    listChildrenByIds(supabase, [claim.data.child_id]),
    listCarerDetailProfilesByUserIds(supabase, [claim.data.foster_carer_id]),
    listAttachmentsForClaims(supabase, [id]),
    listCommentsForClaim(supabase, id),
  ]);
  if (children.error) return serviceFailure({ error: children.error });
  if (carers.error) return serviceFailure({ error: carers.error });
  if (attachments.error) return serviceFailure({ error: attachments.error });
  if (comments.error) return serviceFailure({ error: comments.error });

  const authorIds = [...new Set(comments.data.map((c) => c.user_id))];
  const authors = await listCarerDetailProfilesByUserIds(supabase, authorIds);
  if (authors.error) return serviceFailure({ error: authors.error });
  const authorsById = new Map(authors.data.map((a) => [a.user_id, a]));

  return serviceSuccess<ExpenseClaimDetailDto>(
    toExpenseDetailDto({
      row: claim.data,
      child: toExpensePersonFromChild(children.data[0] ?? null),
      fosterCarer: toExpensePersonFromProfile(carers.data[0] ?? null),
      attachments: attachments.data.map(toExpenseAttachmentDto),
      comments: comments.data.map((row) => {
        const author = authorsById.get(row.user_id);
        const name = author
          ? [author.first_name, author.last_name]
              .map((s) => s?.trim())
              .filter(Boolean)
              .join(" ")
          : null;
        return toExpenseCommentDto(row, name || null);
      }),
    }),
  );
}

export async function createExpenseForCarer(
  supabase: SupabaseClient,
  userId: string,
  body: CreateExpenseClaimBody,
) {
  const childId = body.childId?.trim() ?? "";
  const expenseDate = body.expenseDate?.trim() ?? "";
  const amount = Number(body.amount);
  const description = body.description?.trim() || null;

  if (!childId || !isValidDate(expenseDate) || !Number.isFinite(amount) || amount <= 0) {
    return serviceFailure({ badRequest: true });
  }

  const attachments = normalizeAttachments(body.attachments, userId);
  if (attachments.badRequest) return serviceFailure({ badRequest: true });

  const agency = await findAgencyIdForUser(supabase, userId);
  if (agency.error) return serviceFailure({ error: agency.error });
  if (!agency.agencyId) {
    return serviceFailure({ badRequest: true, error: new Error("agency") });
  }

  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) return serviceFailure({ error: householdError });
  const access = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (access.error) return serviceFailure({ error: access.error });
  if (!access.allowed) return serviceFailure({ forbidden: true });

  const inserted = await insertExpenseClaim(supabase, {
    agencyId: agency.agencyId,
    childId,
    fosterCarerId: userId,
    createdBy: userId,
    amount,
    expenseDate: expenseDate.slice(0, 10),
    description,
  });
  if (inserted.error || !inserted.data) {
    return serviceFailure({
      error: inserted.error ?? new Error("Failed to create expense claim"),
    });
  }

  if (attachments.files.length > 0) {
    const attach = await insertExpenseAttachments(
      supabase,
      inserted.data.id,
      userId,
      attachments.files,
    );
    if (attach.error) return serviceFailure({ error: attach.error });
  }

  return getExpenseForCarer(supabase, userId, inserted.data.id);
}

export async function updateExpenseForCarer(
  supabase: SupabaseClient,
  userId: string,
  claimId: string,
  body: UpdateExpenseClaimBody,
) {
  const id = claimId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const existing = await findExpenseClaimByIdForCarer(supabase, id, userId);
  if (existing.error) return serviceFailure({ error: existing.error });
  if (!existing.data) return serviceFailure({ notFound: true });

  const status = (existing.data.status ?? "new").toLowerCase();
  if (status !== "new" && status !== "declined") {
    return serviceFailure({ notEditable: true });
  }

  const childId = body.childId?.trim() || existing.data.child_id;
  const expenseDate = (body.expenseDate?.trim() || existing.data.expense_date).slice(0, 10);
  const amount =
    body.amount != null ? Number(body.amount) : Number(existing.data.amount);
  const description =
    body.description !== undefined
      ? body.description?.trim() || null
      : existing.data.description;

  if (!childId || !isValidDate(expenseDate) || !Number.isFinite(amount) || amount <= 0) {
    return serviceFailure({ badRequest: true });
  }

  const attachments = normalizeAttachments(body.attachments, userId);
  if (attachments.badRequest) return serviceFailure({ badRequest: true });

  const { householdIds, error: householdError } = await getActiveHouseholdIds(
    supabase,
    userId,
  );
  if (householdError) return serviceFailure({ error: householdError });
  const access = await assertChildAccessibleToCarer(
    supabase,
    childId,
    householdIds,
  );
  if (access.error) return serviceFailure({ error: access.error });
  if (!access.allowed) return serviceFailure({ forbidden: true });

  const updated = await updateExpenseClaim(supabase, id, {
    childId,
    amount,
    expenseDate,
    description,
  });
  if (updated.error || !updated.data) {
    return serviceFailure({
      error: updated.error ?? new Error("Failed to update expense claim"),
    });
  }

  if (attachments.files.length > 0) {
    const attach = await insertExpenseAttachments(
      supabase,
      id,
      userId,
      attachments.files,
    );
    if (attach.error) return serviceFailure({ error: attach.error });
  }

  return getExpenseForCarer(supabase, userId, id);
}

export async function addExpenseCommentForCarer(
  supabase: SupabaseClient,
  userId: string,
  claimId: string,
  body: CreateExpenseCommentBody,
) {
  const id = claimId.trim();
  const text = body.body?.trim() ?? "";
  if (!id || !text) return serviceFailure({ badRequest: true });

  const claim = await findExpenseClaimByIdForCarer(supabase, id, userId);
  if (claim.error) return serviceFailure({ error: claim.error });
  if (!claim.data) return serviceFailure({ notFound: true });

  const inserted = await insertExpenseComment(supabase, {
    claimId: id,
    userId,
    body: text,
  });
  if (inserted.error || !inserted.data) {
    return serviceFailure({
      error: inserted.error ?? new Error("Failed to add comment"),
    });
  }

  return getExpenseForCarer(supabase, userId, id);
}
