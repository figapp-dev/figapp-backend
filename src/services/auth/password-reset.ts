import { env } from "../../config/env.js";
import { createServiceRoleClient } from "../../lib/supabase.js";
import { sendMail } from "../../lib/mail.js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";

const GENERIC_MESSAGE =
  "If an account exists for that email, a password reset link has been sent.";

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function buildResetEmailHtml(firstName: string | null, resetUrl: string): string {
  const greeting = firstName?.trim() ? `Hello ${firstName.trim()},` : "Hello,";
  return `
    <div style="font-family: Arial, Helvetica, sans-serif; max-width: 600px; margin: 0 auto; color: #09090f;">
      <h1 style="color: #1a9e4a; font-size: 22px; text-align: center;">Reset your FigApp password</h1>
      <p>${greeting}</p>
      <p>We received a request to reset the password for your FigApp account. Click the button below to choose a new password:</p>
      <div style="text-align: center; margin: 28px 0;">
        <a href="${resetUrl}"
           style="background: linear-gradient(135deg, #1a9e4a, #c084fc); color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block; font-weight: 700;">
          Reset password
        </a>
      </div>
      <p style="font-size: 14px; color: #667085;">If the button does not work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all; color: #667085; font-size: 13px;">${resetUrl}</p>
      <p style="font-size: 14px; color: #667085;">This link expires in about an hour. If you did not request a reset, you can ignore this email.</p>
      <hr style="margin: 28px 0; border: none; border-top: 1px solid #dce4ef;" />
      <p style="color: #667085; font-size: 12px; text-align: center;">
        Sent by FigApp · <a href="${env.webAppUrl}" style="color: #1a9e4a;">figapp.co.uk</a>
      </p>
    </div>
  `.trim();
}

/**
 * Public password-reset request. Always returns the same success payload so
 * callers cannot probe which emails have accounts.
 */
export async function requestPasswordReset(emailRaw: string) {
  const email = emailRaw.trim().toLowerCase();
  if (!email || !isValidEmail(email)) {
    return serviceFailure({ badRequest: true });
  }

  if (!env.supabaseServiceRoleKey) {
    return serviceFailure({
      error: new Error("SUPABASE_SERVICE_ROLE_KEY is not configured"),
    });
  }
  if (!env.resendApiKey) {
    return serviceFailure({
      error: new Error("RESEND_API_KEY is not configured"),
    });
  }

  const admin = createServiceRoleClient();

  let firstName: string | null = null;
  const { data: profile } = await admin
    .from("profiles")
    .select("first_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (profile && typeof profile === "object") {
    const row = profile as { first_name?: string | null };
    firstName = row.first_name ?? null;
  }

  const { data: linkData, error: linkError } =
    await admin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo: `${env.webAppUrl}/auth?mode=reset`,
      },
    });

  // Unknown email / generate failure → still "success" (no enumeration).
  if (linkError || !linkData?.properties) {
    return serviceSuccess({ ok: true as const, message: GENERIC_MESSAGE });
  }

  const hashedToken = linkData.properties.hashed_token?.trim();
  const actionLink = linkData.properties.action_link?.trim();

  // Brand-facing link on figapp.co.uk (not *.supabase.co). The web app
  // calls verifyOtp with token_hash, then shows the set-password form.
  // Fall back to action_link only if hashed_token is missing.
  const resetUrl = hashedToken
    ? `${env.webAppUrl}/auth?token_hash=${encodeURIComponent(hashedToken)}&type=recovery&mode=reset`
    : actionLink;

  if (!resetUrl) {
    return serviceSuccess({ ok: true as const, message: GENERIC_MESSAGE });
  }

  const mail = await sendMail({
    to: email,
    subject: "Reset your FigApp password",
    html: buildResetEmailHtml(firstName, resetUrl),
    text: [
      firstName?.trim() ? `Hello ${firstName.trim()},` : "Hello,",
      "",
      "Reset your FigApp password using this link:",
      resetUrl,
      "",
      "This link expires in about an hour. If you did not request a reset, ignore this email.",
      "",
      "— FigApp",
    ].join("\n"),
  });

  if (!mail.delivered) {
    return serviceFailure({
      error: new Error(mail.reason ?? "Failed to send password reset email"),
    });
  }

  return serviceSuccess({ ok: true as const, message: GENERIC_MESSAGE });
}
