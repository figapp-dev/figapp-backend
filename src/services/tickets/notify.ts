import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../../config/env.js";
import type { TicketMessageRow, TicketRow } from "../../types/tickets.js";

type TicketNotifyPayload = {
  type: "INSERT" | "UPDATE";
  table: "tickets" | "ticket_messages";
  record: Record<string, unknown>;
  old_record?: Record<string, unknown> | null;
};

/**
 * Invokes the same `ticket-notify` edge function the web app uses after
 * create / comment. Failures are logged only — never fail the ticket write.
 */
export async function invokeTicketNotify(
  supabase: SupabaseClient,
  body: TicketNotifyPayload,
): Promise<void> {
  try {
    if (env.supabaseServiceRoleKey) {
      const response = await fetch(
        `${env.supabaseUrl}/functions/v1/ticket-notify`,
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
          `ticket-notify HTTP ${response.status}:`,
          text.slice(0, 300),
        );
      }
      return;
    }

    const { error } = await supabase.functions.invoke("ticket-notify", {
      body,
    });
    if (error) {
      console.error("ticket-notify failed:", error.message ?? error);
    }
  } catch (error) {
    console.error("ticket-notify invoke error:", error);
  }
}

/** After create — platform support tickets and agency (carer) tickets. */
export async function notifyTicketCreated(
  supabase: SupabaseClient,
  ticket: TicketRow,
): Promise<void> {
  await invokeTicketNotify(supabase, {
    type: "INSERT",
    table: "tickets",
    record: ticket as unknown as Record<string, unknown>,
  });
}

/** After a new comment — notifies other ticket participants (creator, assignee, etc.). */
export async function notifyTicketComment(
  supabase: SupabaseClient,
  message: TicketMessageRow,
): Promise<void> {
  await invokeTicketNotify(supabase, {
    type: "INSERT",
    table: "ticket_messages",
    record: message as unknown as Record<string, unknown>,
  });
}
