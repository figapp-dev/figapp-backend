import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../lib/service-result.js";
import {
  preferencesDtoToRow,
  toNotificationDto,
  toNotificationPreferencesDto,
} from "../mappers/notifications.js";
import {
  countUnreadNotifications,
  findNotificationPreferences,
  listNotificationsForUser,
  markAllNotificationsRead,
  markNotificationRead,
  upsertNotificationPreferences,
} from "../repositories/notifications.js";
import type {
  NotificationListFilter,
  NotificationPreferencesDto,
} from "../types/notifications.js";

export async function listNotifications(
  supabase: SupabaseClient,
  userId: string,
  filter: NotificationListFilter = "all",
) {
  const [listed, unread] = await Promise.all([
    listNotificationsForUser(supabase, userId, filter),
    countUnreadNotifications(supabase, userId),
  ]);

  if (listed.error) return serviceFailure({ error: listed.error });
  if (unread.error) return serviceFailure({ error: unread.error });

  return serviceSuccess({
    notifications: listed.data.map(toNotificationDto),
    unreadCount: unread.data,
  });
}

export async function getUnreadNotificationCount(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await countUnreadNotifications(supabase, userId);
  if (result.error) return serviceFailure({ error: result.error });
  return serviceSuccess({ unreadCount: result.data });
}

export async function markNotificationAsRead(
  supabase: SupabaseClient,
  userId: string,
  notificationId: string,
) {
  const result = await markNotificationRead(supabase, userId, notificationId);
  if (result.error) return serviceFailure({ error: result.error });
  if (result.notFound || !result.data) return serviceFailure({ notFound: true });
  return serviceSuccess(toNotificationDto(result.data));
}

export async function markAllNotificationsAsRead(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await markAllNotificationsRead(supabase, userId);
  if (result.error) return serviceFailure({ error: result.error });
  return serviceSuccess({ ok: true as const, count: result.data });
}

export async function getNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
) {
  const result = await findNotificationPreferences(supabase, userId);
  if (result.error) return serviceFailure({ error: result.error });
  return serviceSuccess(toNotificationPreferencesDto(result.data));
}

export async function putNotificationPreferences(
  supabase: SupabaseClient,
  userId: string,
  body: NotificationPreferencesDto,
) {
  const result = await upsertNotificationPreferences(
    supabase,
    preferencesDtoToRow(userId, body),
  );
  if (result.error || !result.data) {
    return serviceFailure({ error: result.error });
  }
  return serviceSuccess(toNotificationPreferencesDto(result.data));
}
