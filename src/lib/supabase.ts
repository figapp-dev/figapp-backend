import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

const authNone = {
  persistSession: false,
  autoRefreshToken: false,
} as const;

export function createUserClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: authNone,
  });
}

/**
 * Service-role client. Use only after an explicit authz check (or webhook
 * signature verification). Bypasses RLS for privileged billing writes.
 */
export function createServiceRoleClient(): SupabaseClient {
  if (!env.supabaseServiceRoleKey) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not configured");
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: authNone,
  });
}
