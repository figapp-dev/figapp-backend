import { env } from "../config/env.js";

export type MailMessage = {
  to: string;
  subject: string;
  html?: string;
  text?: string;
};

export type MailResult = {
  delivered: boolean;
  skipped: boolean;
  reason?: string;
};

/** Send via Resend. Skips when RESEND_API_KEY is unset. */
export async function sendMail(message: MailMessage): Promise<MailResult> {
  const apiKey = env.resendApiKey;
  const from = env.mailFromEmail;
  if (!apiKey) {
    return {
      delivered: false,
      skipped: true,
      reason: "RESEND_API_KEY is not set",
    };
  }
  if (!message.html && !message.text) {
    return {
      delivered: false,
      skipped: false,
      reason: "email body is empty",
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
        ...(message.html ? { html: message.html } : {}),
        ...(message.text ? { text: message.text } : {}),
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
