import type {
  BillingExemptionBody,
  CreateBillingRequestBody,
} from "../types/billing.js";

export const createBillingRequestBodySchema = {
  type: "object",
  required: ["successRedirectUrl"],
  additionalProperties: false,
  properties: {
    successRedirectUrl: {
      type: "string",
      minLength: 1,
      description:
        "Absolute URL GoCardless redirects to after the payer completes the hosted flow",
    },
    exitRedirectUrl: {
      type: "string",
      minLength: 1,
      description:
        "Absolute URL if the payer exits without completing. Defaults to successRedirectUrl.",
    },
  },
} as const;

export const billingExemptionBodySchema = {
  type: "object",
  required: ["billingExempt"],
  additionalProperties: false,
  properties: {
    billingExempt: { type: "boolean" },
    setupFeeSelected: { type: "boolean" },
    setupFeeAmountGbp: { type: "number", minimum: 0 },
    setupFeeDiscountPercent: { type: "number", minimum: 0, maximum: 100 },
  },
} as const;

export type { BillingExemptionBody, CreateBillingRequestBody };
