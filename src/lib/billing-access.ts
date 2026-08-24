import type { AgencyBillingStatus } from "../types/billing.js";

export type BillingAccessFlags = {
  canUseApp: boolean;
  needsPaymentSetup: boolean;
};

/**
 * Product rules:
 * - Demo / billing_exempt: always usable, no GoCardless.
 * - Mandate required before unlock (pending_setup → blocked).
 * - After mandate, status moves to active even if first DD is pending.
 * - past_due stays usable until day-29 suspend (status becomes suspended).
 */
export function billingAccessFromAgency(params: {
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
}): BillingAccessFlags {
  if (params.billingExempt || params.billingStatus === "billing_exempt") {
    return { canUseApp: true, needsPaymentSetup: false };
  }

  if (params.billingStatus === "pending_setup") {
    return { canUseApp: false, needsPaymentSetup: true };
  }

  if (params.billingStatus === "suspended") {
    return { canUseApp: false, needsPaymentSetup: false };
  }

  return { canUseApp: true, needsPaymentSetup: false };
}

/** Bacs mandates can collect before `active` (pending_submission / submitted). */
export const USABLE_MANDATE_STATUSES = [
  "pending_submission",
  "submitted",
  "active",
  "reinstated",
] as const;

export function isUsableMandateStatus(status: string | null | undefined): boolean {
  if (!status) return false;
  return (USABLE_MANDATE_STATUSES as readonly string[]).includes(status);
}

export function isPaymentSuccessAction(action: string | undefined): boolean {
  return action === "confirmed" || action === "paid_out";
}

export function isPaymentFailureAction(action: string | undefined): boolean {
  return (
    action === "failed" ||
    action === "cancelled" ||
    action === "charged_back" ||
    action === "customer_approval_denied"
  );
}

export function isMandateUsableAction(action: string | undefined): boolean {
  return (
    action === "created" ||
    action === "submitted" ||
    action === "active" ||
    action === "reinstated" ||
    action === "transferred" ||
    action === "replaced"
  );
}

export function isMandateTerminalAction(action: string | undefined): boolean {
  return (
    action === "cancelled" ||
    action === "failed" ||
    action === "expired" ||
    action === "blocked" ||
    action === "consumed"
  );
}

export function hasUsablePaymentMethod(
  methods: Array<{ status: string | null | undefined }>,
): boolean {
  return methods.some((row) => isUsableMandateStatus(row.status));
}

/**
 * After a mandate is cancelled/failed/expired: lock commercial agencies that
 * no longer have a usable Direct Debit so /billing/access sends them back
 * through setup. Exempt agencies stay open. A replacement usable mandate
 * keeps them unlocked.
 */
export function shouldRevertToPendingSetupAfterMandateLoss(params: {
  billingExempt: boolean;
  billingStatus: AgencyBillingStatus;
  hasUsableMandate: boolean;
}): boolean {
  if (params.billingExempt || params.billingStatus === "billing_exempt") {
    return false;
  }
  if (params.hasUsableMandate) return false;
  return params.billingStatus !== "pending_setup";
}

export function gocardlessEventType(
  resourceType: string | undefined,
  action: string | undefined,
): string {
  return `${resourceType ?? "unknown"}.${action ?? "unknown"}`;
}
