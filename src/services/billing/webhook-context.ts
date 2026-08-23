import type { Event } from "gocardless-nodejs";
import type { GoCardlessClient } from "gocardless-nodejs";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AgencyBillingRow } from "../../types/billing.js";

export type GcWebhookHandlerParams = {
  adminDb: SupabaseClient;
  gc: GoCardlessClient;
  agency: AgencyBillingRow;
  event: Event;
};
