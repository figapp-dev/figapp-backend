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

export const env = {
  nodeEnv,
  isProduction,
  port,
  supabaseUrl,
  supabasePublishableKey,
  /** Swagger UI + OpenAPI JSON at /docs. Off in production unless ENABLE_DOCS=true. */
  enableDocs: parseEnableDocs(process.env.ENABLE_DOCS),
  corsOrigins: parseCorsOrigins(process.env.CORS_ORIGINS),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX) || 200,
  rateLimitWindow: process.env.RATE_LIMIT_WINDOW?.trim() || "1 minute",
} as const;
