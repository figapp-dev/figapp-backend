import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type { FcmDeviceTokenRow } from "../types/fcm.js";

const TOKEN_SELECT =
  "id, user_id, token, platform, device_id, app_version, last_seen_at, created_at, updated_at";

export async function upsertDeviceToken(
  supabase: SupabaseClient,
  row: Record<string, unknown>,
): Promise<{ data: FcmDeviceTokenRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.FCM_DEVICE_TOKENS)
    .upsert(row, { onConflict: "token" })
    .select(TOKEN_SELECT)
    .single();

  return {
    data: (data as FcmDeviceTokenRow | null) ?? null,
    error,
  };
}

export async function deleteDeviceToken(
  supabase: SupabaseClient,
  userId: string,
  token: string,
): Promise<{ data: number; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.FCM_DEVICE_TOKENS)
    .delete()
    .eq("token", token)
    .eq("user_id", userId)
    .select("id");

  return {
    data: data?.length ?? 0,
    error,
  };
}
