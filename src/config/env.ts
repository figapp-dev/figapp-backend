import { config as loadEnv } from "dotenv";

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

// Hosting platforms inject env vars into process.env.
// Only load .env for local / non-production.
if (!isProduction) {
  loadEnv();
}

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }

  return value;
}

function parseCorsOrigins(raw: string | undefined): string[] | true | false {
  const value = raw?.trim();
  if (!value) {
    // Dev: allow any origin for local tools. Prod: deny browser CORS by default
    // (Flutter native does not need CORS).
    return isProduction ? false : true;
  }
  if (value === "*") return true;
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function parseEnableDocs(raw: string | undefined): boolean {
  if (raw === "true") return true;
  if (raw === "false") return false;
  // Default: on in non-production, off in production.
  return !isProduction;
}

const port = Number(process.env.PORT) || 3000;
const supabaseUrl = required("SUPABASE_URL");
const supabasePublishableKey = required("SUPABASE_PUBLISHABLE_KEY");

if (!/^https:\/\//i.test(supabaseUrl)) {
  throw new Error("SUPABASE_URL must be an https URL");
}

const gocardlessEnvRaw = process.env.GOCARDLESS_ENV?.trim().toLowerCase();

export const env = {
  nodeEnv,
  isProduction,
  port,
  supabaseUrl,
  supabasePublishableKey,
  /**
   * Privileged Supabase key. Required for GoCardless webhooks and billing
   * writes that RLS does not allow agency members to perform. Optional at
   * boot so non-billing routes keep working before secrets are set.
   */
  supabaseServiceRoleKey:
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "",
  /** Swagger UI + OpenAPI JSON at /docs. Off in production unless ENABLE_DOCS=true. */
  enableDocs: parseEnableDocs(process.env.ENABLE_DOCS),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  rateLimitWindow: process.env.RATE_LIMIT_WINDOW?.trim() || "1 minute",
  gocardlessAccessToken: process.env.GOCARDLESS_ACCESS_TOKEN?.trim() || "",
  gocardlessWebhookSecret: process.env.GOCARDLESS_WEBHOOK_SECRET?.trim() || "",
  gocardlessEnv: gocardlessEnvRaw === "live" ? "live" : "sandbox",
  /**
   * Railway (or similar) cron for licence one-off catch-up.
   * Optional at boot; the collect route returns 500 until it is set.
   */
  billingCronSecret: process.env.BILLING_CRON_SECRET?.trim() || "",
  /** Optional Resend key for dunning mail. Collect still suspends without it. */
  resendApiKey: process.env.RESEND_API_KEY?.trim() || "",
  billingFromEmail: process.env.BILLING_FROM_EMAIL?.trim() || "",
} as const;
