import { config as loadEnv } from "dotenv";

// Hosting platforms inject env vars into process.env.
// Only load .env for local development.
if (process.env.NODE_ENV !== "production") {
  loadEnv();
}

function required(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Missing env variable: ${name}`);
  }

  return value;
}

const port = Number(process.env.PORT) || 3000;
const supabaseUrl = required("SUPABASE_URL");
const supabasePublishableKey = required("SUPABASE_PUBLISHABLE_KEY");

export const env = {
  port,
  supabaseUrl,
  supabasePublishableKey,
} as const;
