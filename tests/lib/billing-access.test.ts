import { describe, expect, it } from "vitest";
import {
  billingAccessFromAgency,
  hasUsablePaymentMethod,
  isMandateTerminalAction,
  isMandateUsableAction,
  isPaymentFailureAction,
  isPaymentSuccessAction,
  isUsableMandateStatus,
  shouldRevertToPendingSetupAfterMandateLoss,
} from "../../src/lib/billing-access.js";
import { isAllowedRedirectUrl } from "../../src/lib/redirect-urls.js";

describe("billingAccessFromAgency", () => {
  it("allows exempt agencies", () => {
    expect(
      billingAccessFromAgency({
        billingExempt: true,
        billingStatus: "pending_setup",
      }),
    ).toEqual({ canUseApp: true, needsPaymentSetup: false });
    expect(
      billingAccessFromAgency({
        billingExempt: false,
        billingStatus: "billing_exempt",
      }),
    ).toEqual({ canUseApp: true, needsPaymentSetup: false });
  });

  it("blocks pending_setup until a mandate exists", () => {
    expect(
      billingAccessFromAgency({
        billingExempt: false,
        billingStatus: "pending_setup",
      }),
    ).toEqual({ canUseApp: false, needsPaymentSetup: true });
  });

  it("allows active and past_due (grace) and blocks suspended", () => {
    expect(
      billingAccessFromAgency({
        billingExempt: false,
        billingStatus: "active",
      }),
    ).toEqual({ canUseApp: true, needsPaymentSetup: false });
    expect(
      billingAccessFromAgency({
        billingExempt: false,
        billingStatus: "past_due",
      }),
    ).toEqual({ canUseApp: true, needsPaymentSetup: false });
    expect(
      billingAccessFromAgency({
        billingExempt: false,
        billingStatus: "suspended",
      }),
    ).toEqual({ canUseApp: false, needsPaymentSetup: false });
  });
});

describe("shouldRevertToPendingSetupAfterMandateLoss", () => {
  it("locks commercial agencies with no remaining usable mandate", () => {
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "active",
        hasUsableMandate: false,
      }),
    ).toBe(true);
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "past_due",
        hasUsableMandate: false,
      }),
    ).toBe(true);
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "suspended",
        hasUsableMandate: false,
      }),
    ).toBe(true);
  });

  it("does not lock exempt agencies, replacement mandates, or pending_setup", () => {
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: true,
        billingStatus: "active",
        hasUsableMandate: false,
      }),
    ).toBe(false);
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "billing_exempt",
        hasUsableMandate: false,
      }),
    ).toBe(false);
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "active",
        hasUsableMandate: true,
      }),
    ).toBe(false);
    expect(
      shouldRevertToPendingSetupAfterMandateLoss({
        billingExempt: false,
        billingStatus: "pending_setup",
        hasUsableMandate: false,
      }),
    ).toBe(false);
  });

  it("treats only live mandate statuses as usable", () => {
    expect(hasUsablePaymentMethod([{ status: "cancelled" }])).toBe(false);
    expect(
      hasUsablePaymentMethod([
        { status: "cancelled" },
        { status: "pending_submission" },
      ]),
    ).toBe(true);
  });
});

describe("mandate and payment event helpers", () => {
  it("treats pending_submission and active as usable mandates", () => {
    expect(isUsableMandateStatus("pending_submission")).toBe(true);
    expect(isUsableMandateStatus("active")).toBe(true);
    expect(isUsableMandateStatus("cancelled")).toBe(false);
    expect(isMandateUsableAction("created")).toBe(true);
    expect(isMandateTerminalAction("failed")).toBe(true);
  });

  it("classifies payment actions", () => {
    expect(isPaymentSuccessAction("confirmed")).toBe(true);
    expect(isPaymentSuccessAction("paid_out")).toBe(true);
    expect(isPaymentFailureAction("failed")).toBe(true);
    expect(isPaymentFailureAction("charged_back")).toBe(true);
    expect(isPaymentFailureAction("confirmed")).toBe(false);
  });
});

describe("isAllowedRedirectUrl", () => {
  it("allows https and local http in non-production", () => {
    expect(isAllowedRedirectUrl("https://app.figapp.co.uk/billing/setup/complete")).toBe(
      true,
    );
    expect(isAllowedRedirectUrl("http://localhost:5173/billing/setup/complete")).toBe(
      true,
    );
    expect(isAllowedRedirectUrl("http://evil.example/phish")).toBe(false);
    expect(isAllowedRedirectUrl("/relative")).toBe(false);
  });
});
