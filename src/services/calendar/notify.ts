import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import { listAgencyUsersContactByIds } from "../../repositories/calendar.js";
import type { EventRow } from "../../types/calendar.js";

export type EventNotificationType = "creation" | "participant_added";

type NotifyParticipant = {
  type: "user";
  id: string;
  email?: string;
  name: string;
};

type SendEventNotificationsBody = {
  eventId: string;
  eventTitle: string;
  eventDate: string;
  eventTime: string;
  eventType: string;
  description?: string | null;
  location?: string | null;
  participants: NotifyParticipant[];
  notificationType: EventNotificationType;
  actorId: string;
  affectedUserId?: string;
  agencyId?: string | null;
};

/** HH:mm in Europe/London — matches web `formatUKTime24`. */
export function formatEventTimeUk(isoDatetime: string): string {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(isoDatetime));
  } catch {
    return "";
  }
}

async function buildNotifyParticipants(
  supabase: SupabaseClient,
  userIds: string[],
): Promise<NotifyParticipant[]> {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueIds.length === 0) return [];

  const { data, error } = await listAgencyUsersContactByIds(supabase, uniqueIds);
  if (error) {
    console.error("event notify: failed to load participant contacts", error);
    // Fall back to id-only entries so in-app fan-out still works.
    return uniqueIds.map((id) => ({
      type: "user" as const,
      id,
      name: "Participant",
    }));
  }

  const byId = new Map(data.map((row) => [row.user_id, row]));
  return uniqueIds.map((id) => {
    const row = byId.get(id);
    const name =
      [row?.first_name, row?.last_name].filter(Boolean).join(" ").trim() ||
      "Participant";
    const email = row?.email?.trim() || undefined;
    return {
      type: "user" as const,
      id,
      name,
      ...(email ? { email } : {}),
    };
  });
}

/**
 * Invokes the same Supabase Edge Function the web app uses after create /
 * participant add. Prefer service-role (same as reminder dispatcher); fall
 * back to the caller's client. Failures are logged only — never fail the
 * calendar write.
 */
export async function invokeSendEventNotifications(
  supabase: SupabaseClient,
  body: SendEventNotificationsBody,
): Promise<void> {
  try {
    if (env.supabaseServiceRoleKey) {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/send-event-notifications`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${env.supabaseServiceRoleKey}`,
            apikey: env.supabaseServiceRoleKey,
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) {
        const text = await response.text();
        console.error(
          `send-event-notifications HTTP ${response.status}:`,
          text.slice(0, 300),
        );
      }
      return;
    }

    const { error } = await supabase.functions.invoke(
      "send-event-notifications",
      { body },
    );
    if (error) {
      console.error("send-event-notifications failed:", error.message ?? error);
    }
  } catch (error) {
    console.error("send-event-notifications invoke error:", error);
  }
}

/** After create: email + in-app invites for every non-creator participant. */
export async function notifyEventCreation(
  supabase: SupabaseClient,
  params: {
    actorId: string;
    participantUserIds: string[];
    event: Pick<
      EventRow,
      | "id"
      | "title"
      | "start_datetime"
      | "event_type"
      | "description"
      | "location"
      | "agency_id"
    >;
  },
): Promise<void> {
  const participantUserIds = [
    ...new Set(params.participantUserIds.filter((id) => id !== params.actorId)),
  ];
  if (participantUserIds.length === 0) return;

  const participants = await buildNotifyParticipants(
    supabase,
    participantUserIds,
  );
  if (participants.length === 0) return;

  await invokeSendEventNotifications(supabase, {
    eventId: params.event.id,
    eventTitle: params.event.title,
    eventDate: params.event.start_datetime,
    eventTime: formatEventTimeUk(params.event.start_datetime),
    eventType: params.event.event_type,
    description: params.event.description,
    location: params.event.location,
    participants,
    notificationType: "creation",
    actorId: params.actorId,
    agencyId: params.event.agency_id,
  });
}

/**
 * After edit: one notify per newly added user (deduped across series
 * targets so a multi-occurrence add does not spam one email per row).
 */
export async function notifyParticipantsAdded(
  supabase: SupabaseClient,
  params: {
    actorId: string;
    addedUserIds: string[];
    allParticipantUserIds: string[];
    event: Pick<
      EventRow,
      | "id"
      | "title"
      | "start_datetime"
      | "event_type"
      | "description"
      | "location"
      | "agency_id"
    >;
  },
): Promise<void> {
  const addedUserIds = [
    ...new Set(params.addedUserIds.filter((id) => id !== params.actorId)),
  ];
  if (addedUserIds.length === 0) return;

  const participants = await buildNotifyParticipants(
    supabase,
    params.allParticipantUserIds.filter((id) => id !== params.actorId),
  );

  for (const affectedUserId of addedUserIds) {
    await invokeSendEventNotifications(supabase, {
      eventId: params.event.id,
      eventTitle: params.event.title,
      eventDate: params.event.start_datetime,
      eventTime: formatEventTimeUk(params.event.start_datetime),
      eventType: params.event.event_type,
      description: params.event.description,
      location: params.event.location,
      participants,
      notificationType: "participant_added",
      affectedUserId,
      actorId: params.actorId,
      agencyId: params.event.agency_id,
    });
  }
}
