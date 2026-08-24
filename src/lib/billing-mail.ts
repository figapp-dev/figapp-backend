import { env } from "../config/env.js";

export type BillingMailMessage = {
  to: string;
  subject: string;
  text: string;
};

export type BillingMailResult = {
  delivered: boolean;
  skipped: boolean;
  reason?: string;
};

/**
 * Optional Resend send. Collect still suspends if mail is not configured.
 */
export async function sendBillingMail(
  message: BillingMailMessage,
): Promise<BillingMailResult> {
  const apiKey = env.resendApiKey;
  const from = env.billingFromEmail;
  if (!apiKey || !from) {
    return {
      delivered: false,
      skipped: true,
      reason: "RESEND_API_KEY or BILLING_FROM_EMAIL is not set",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      return {
        delivered: false,
        skipped: false,
        reason: `Resend ${response.status}: ${body.slice(0, 300)}`,
      };
    }
    return { delivered: true, skipped: false };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "mail send failed";
    return { delivered: false, skipped: false, reason };
  }
}

export function dunningNoticeEmail(params: {
  agencyName: string;
  week: number;
  daysPastDue: number;
}): { subject: string; text: string } {
  return {
    subject: `FigApp Direct Debit: payment reminder (${params.week} of ${3})`,
    text: [
      `Hello ${params.agencyName},`,
      "",
      `A FigApp licence Direct Debit has been unpaid for ${params.daysPastDue} day(s).`,
      "Your team can keep using FigApp during a 28-day grace period.",
      "Please update the bank details or contact us if this collection should not have failed.",
      "",
      `This is reminder ${params.week} of 3. On day 29 access is suspended until payment is restored.`,
      "",
      "— FigApp billing",
    ].join("\n"),
  };
}

export function dunningSuspendEmail(params: { agencyName: string }): {
  subject: string;
  text: string;
} {
  return {
    subject: "FigApp access suspended — unpaid Direct Debit",
    text: [
      `Hello ${params.agencyName},`,
      "",
      "A licence Direct Debit has been unpaid for 29 days, so FigApp access is now suspended.",
      "Set up a new Direct Debit or clear the failed payment to restore access.",
      "",
      "— FigApp billing",
    ].join("\n"),
  };
}
