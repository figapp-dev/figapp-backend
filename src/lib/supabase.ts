import { createClient } from "@supabase/supabase-js";
import { env } from "../config/env.js";

export function createUserClient(accessToken: string) {
  return createClient(env.supabaseUrl, env.supabasePublishableKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
