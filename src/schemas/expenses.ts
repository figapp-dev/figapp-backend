import type {
  CreateExpenseClaimBody,
  CreateExpenseCommentBody,
  UpdateExpenseClaimBody,
} from "../types/expenses.js";

export const createExpenseClaimBodySchema = {
  type: "object",
  required: ["childId", "expenseDate", "amount"],
  additionalProperties: false,
  properties: {
    childId: { type: "string", minLength: 1 },
    expenseDate: { type: "string", minLength: 1 },
    amount: { type: "number", exclusiveMinimum: 0 },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    attachments: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        required: ["fileName", "fileSize", "fileType", "storagePath"],
        additionalProperties: false,
        properties: {
          fileName: { type: "string", minLength: 1 },
          fileSize: { type: "integer", minimum: 0 },
          fileType: { type: "string", minLength: 1 },
          storagePath: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export const updateExpenseClaimBodySchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    childId: { type: "string", minLength: 1 },
    expenseDate: { type: "string", minLength: 1 },
    amount: { type: "number", exclusiveMinimum: 0 },
    description: { anyOf: [{ type: "string" }, { type: "null" }] },
    attachments: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        required: ["fileName", "fileSize", "fileType", "storagePath"],
        additionalProperties: false,
        properties: {
          fileName: { type: "string", minLength: 1 },
          fileSize: { type: "integer", minimum: 0 },
          fileType: { type: "string", minLength: 1 },
          storagePath: { type: "string", minLength: 1 },
        },
      },
    },
  },
} as const;

export const createExpenseCommentBodySchema = {
  type: "object",
  required: ["body"],
  additionalProperties: false,
  properties: {
    body: { type: "string", minLength: 1 },
  },
} as const;

export type {
  CreateExpenseClaimBody,
  CreateExpenseCommentBody,
  UpdateExpenseClaimBody,
};
