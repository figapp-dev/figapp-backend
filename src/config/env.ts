import "dotenv/config";

const port = Number(process.env.PORT) || 3000;
const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env variable for Supabase Url");
}

if (!supabasePublishableKey) {
  throw new Error("Missing env variable for Supabase publishable key");
}

export const env = {
  port,
  supabaseUrl,
  supabasePublishableKey,
} as const;
