import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import {
  addExpenseCommentForCarer,
  createExpenseForCarer,
  getExpenseForCarer,
  listExpensesForCarer,
  updateExpenseForCarer,
} from "../services/expenses/index.js";
import {
  badRequest,
  forbidden,
  internalError,
  notFound,
} from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import {
  createExpenseClaimBodySchema,
  createExpenseCommentBodySchema,
  updateExpenseClaimBodySchema,
} from "../schemas/expenses.js";
import type {
  CreateExpenseClaimBody,
  CreateExpenseCommentBody,
  ExpenseClaimStatus,
  UpdateExpenseClaimBody,
} from "../types/expenses.js";

export async function expensesRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get<{
    Querystring: { status?: ExpenseClaimStatus; q?: string };
  }>(
    "/expenses",
    {
      schema: {
        tags: ["expenses"],
        summary: "List expense claims for the signed-in foster carer",
        security: [...bearerSecurity],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: {
              type: "string",
              enum: ["new", "approved", "declined", "paid"],
            },
            q: { type: "string" },
          },
        },
        response: {
          200: { $ref: "ExpenseClaimsListDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await listExpensesForCarer(
        request.supabase,
        request.user.id,
        { status: request.query.status, q: request.query.q },
      );
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.EXPENSES_LIST_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.post<{ Body: CreateExpenseClaimBody }>(
    "/expenses",
    {
      schema: {
        tags: ["expenses"],
        summary: "Create an expense claim",
        security: [...bearerSecurity],
        body: createExpenseClaimBodySchema,
        response: {
          200: { $ref: "ExpenseClaimDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await createExpenseForCarer(
        request.supabase,
        request.user.id,
        request.body,
      );
      if (result.badRequest) {
        throw badRequest(
          result.error?.message?.includes("agency")
            ? ErrorMessages.EXPENSE_NO_AGENCY
            : ErrorMessages.EXPENSE_INVALID_BODY,
        );
      }
      if (result.forbidden) {
        throw forbidden(ErrorMessages.EXPENSE_ACCESS_DENIED);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.EXPENSE_CREATE_FAILED);
      }
      return result.data;
    },
  );

  app.get<{ Params: { id: string } }>(
    "/expenses/:id",
    {
      schema: {
        tags: ["expenses"],
        summary: "Expense claim detail",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        response: {
          200: { $ref: "ExpenseClaimDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getExpenseForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
      );
      if (result.badRequest) throw badRequest(ErrorMessages.EXPENSE_INVALID_BODY);
      if (result.notFound) throw notFound(ErrorMessages.EXPENSE_NOT_FOUND);
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.EXPENSE_LOAD_FAILED);
      }
      return result.data;
    },
  );

  app.put<{ Params: { id: string }; Body: UpdateExpenseClaimBody }>(
    "/expenses/:id",
    {
      schema: {
        tags: ["expenses"],
        summary: "Update an editable expense claim (new or declined)",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: updateExpenseClaimBodySchema,
        response: {
          200: { $ref: "ExpenseClaimDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await updateExpenseForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body ?? {},
      );
      if (result.badRequest) throw badRequest(ErrorMessages.EXPENSE_INVALID_BODY);
      if (result.forbidden) throw forbidden(ErrorMessages.EXPENSE_ACCESS_DENIED);
      if (result.notFound) throw notFound(ErrorMessages.EXPENSE_NOT_FOUND);
      if (result.notEditable) throw badRequest(ErrorMessages.EXPENSE_NOT_EDITABLE);
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.EXPENSE_UPDATE_FAILED);
      }
      return result.data;
    },
  );

  app.post<{ Params: { id: string }; Body: CreateExpenseCommentBody }>(
    "/expenses/:id/comments",
    {
      schema: {
        tags: ["expenses"],
        summary: "Add a comment on an expense claim",
        security: [...bearerSecurity],
        params: {
          type: "object",
          required: ["id"],
          properties: { id: { type: "string" } },
        },
        body: createExpenseCommentBodySchema,
        response: {
          200: { $ref: "ExpenseClaimDetailDto#" },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await addExpenseCommentForCarer(
        request.supabase,
        request.user.id,
        request.params.id,
        request.body,
      );
      if (result.badRequest) throw badRequest(ErrorMessages.EXPENSE_INVALID_BODY);
      if (result.notFound) throw notFound(ErrorMessages.EXPENSE_NOT_FOUND);
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.EXPENSE_COMMENT_FAILED);
      }
      return result.data;
    },
  );
}
