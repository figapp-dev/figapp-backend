import { createServiceRoleClient } from "../lib/supabase.js";
import { serviceFailure, serviceSuccess } from "../lib/service-result.js";
import {
  deleteDeviceToken,
  upsertDeviceToken,
} from "../repositories/fcm-tokens.js";
import { toError } from "../lib/errors.js";
import type { RegisterFcmTokenBody } from "../types/fcm.js";

/**
 * An FCM registration token identifies a device install, not a person. If a
 * second user signs in on a phone the previous user never signed out of, the
 * token has to move to them or the old user keeps receiving pushes they can
 * read on someone else's screen. Reassigning means writing a row the caller
 * does not own, which RLS forbids, so these run with the service role after
 * `requireAuth` has proved who the caller is.
 */
export async function registerDeviceToken(
  userId: string,
  body: RegisterFcmTokenBody,
) {
  const token = body.token.trim();
  if (!token) return serviceFailure({ badRequest: true });

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }

  const now = new Date().toISOString();
  const result = await upsertDeviceToken(supabase, {
    user_id: userId,
    token,
    platform: body.platform,
    device_id: body.deviceId?.trim() || null,
    app_version: body.appVersion?.trim() || null,
    last_seen_at: now,
    updated_at: now,
  });

  if (result.error || !result.data) {
    return serviceFailure({ error: result.error });
  }
  return serviceSuccess({ ok: true as const });
}

export async function unregisterDeviceToken(userId: string, rawToken: string) {
  const token = rawToken.trim();
  if (!token) return serviceFailure({ badRequest: true });

  let supabase;
  try {
    supabase = createServiceRoleClient();
  } catch (error) {
    return serviceFailure({ error: toError(error) });
  }

  const result = await deleteDeviceToken(supabase, userId, token);
  if (result.error) return serviceFailure({ error: result.error });
  return serviceSuccess({ ok: true as const, count: result.data });
}
