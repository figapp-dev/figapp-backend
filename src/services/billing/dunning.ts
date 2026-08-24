import type { SupabaseClient } from "@supabase/supabase-js";
import {
  dunningNoticeEventId,
  dunningSuspendEventId,
  planDunning,
} from "../../lib/billing-dunning.js";
import {
  dunningNoticeEmail,
  dunningSuspendEmail,
  sendBillingMail,
  type BillingMailResult,
} from "../../lib/billing-mail.js";
import { getTodayUKDateString } from "../../lib/dates.js";
import {
  findBillingEventByEventId,
  insertBillingEvent,
  listPastDueAgenciesForDunning,
  updateAgencyBilling,
} from "../../repositories/billing.js";
import type { AgencyBillingRow } from "../../types/billing.js";
import { agencyBillingEmail } from "./quotes.js";

const DUNNING_PROVIDER = "figapp";

export type DunningRunResult = {
  agenciesReviewed: number;
  noticesSent: number;
  agenciesSuspended: number;
  errors: Array<{ agencyId: string; message: string }>;
};

async function eventExists(
  adminDb: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  const existing = await findBillingEventByEventId(
    adminDb,
    DUNNING_PROVIDER,
    eventId,
  );
  if (existing.error) throw existing.error;
  return !!existing.data;
}

async function recordDunningEvent(params: {
  adminDb: SupabaseClient;
  agencyId: string;
  eventId: string;
  eventType: string;
  payload: unknown;
}): Promise<void> {
  const inserted = await insertBillingEvent(params.adminDb, {
    agency_id: params.agencyId,
    provider: DUNNING_PROVIDER,
    event_id: params.eventId,
    event_type: params.eventType,
    resource_type: "dunning",
    resource_id: params.agencyId,
    payload: params.payload,
  });
  if (inserted.error && !inserted.duplicate) throw inserted.error;
}

async function sendAndRecordNotice(params: {
  adminDb: SupabaseClient;
  agency: AgencyBillingRow;
  week: number;
  daysPastDue: number;
}): Promise<"sent" | "skipped"> {
  const eventId = dunningNoticeEventId(params.agency.id, params.week);
  if (await eventExists(params.adminDb, eventId)) return "skipped";

  const to = agencyBillingEmail(params.agency);
  const copy = dunningNoticeEmail({
    agencyName: params.agency.name,
    week: params.week,
    daysPastDue: params.daysPastDue,
  });

  let mailResult: BillingMailResult = {
    delivered: false,
    skipped: true,
    reason: "no billing email on agency",
  };
  if (to) {
    mailResult = await sendBillingMail({
      to,
      subject: copy.subject,
      text: copy.text,
    });
    if (!mailResult.delivered && !mailResult.skipped) {
      throw new Error(mailResult.reason ?? "mail send failed");
    }
  }

  await recordDunningEvent({
    adminDb: params.adminDb,
    agencyId: params.agency.id,
    eventId,
    eventType: "dunning.notice",
    payload: {
      week: params.week,
      daysPastDue: params.daysPastDue,
      mail: mailResult,
    },
  });
  return mailResult.delivered ? "sent" : "skipped";
}

async function suspendAgency(params: {
  adminDb: SupabaseClient;
  agency: AgencyBillingRow;
  today: string;
}): Promise<void> {
  const since = params.agency.past_due_since ?? params.today;
  const eventId = dunningSuspendEventId(params.agency.id, since);
  if (await eventExists(params.adminDb, eventId)) return;

  const { error } = await updateAgencyBilling(params.adminDb, params.agency.id, {
    billing_status: "suspended",
    suspended_at: `${params.today}T00:00:00.000Z`,
  });
  if (error) throw error;
  params.agency.billing_status = "suspended";
  params.agency.suspended_at = params.today;

  const to = agencyBillingEmail(params.agency);
  const copy = dunningSuspendEmail({ agencyName: params.agency.name });
  let mail: BillingMailResult = {
    delivered: false,
    skipped: true,
    reason: "no billing email on agency",
  };
  if (to) {
    mail = await sendBillingMail({
      to,
      subject: copy.subject,
      text: copy.text,
    });
  }

  await recordDunningEvent({
    adminDb: params.adminDb,
    agencyId: params.agency.id,
    eventId,
    eventType: "dunning.suspend",
    payload: { pastDueSince: since, mail },
  });
}

export async function runPastDueDunning(
  adminDb: SupabaseClient,
  today: string = getTodayUKDateString(),
): Promise<DunningRunResult> {
  const agenciesRes = await listPastDueAgenciesForDunning(adminDb);
  if (agenciesRes.error) throw agenciesRes.error;

  const result: DunningRunResult = {
    agenciesReviewed: agenciesRes.data.length,
    noticesSent: 0,
    agenciesSuspended: 0,
    errors: [],
  };

  for (const agency of agenciesRes.data) {
    try {
      const plan = planDunning({
        pastDueSince: agency.past_due_since,
        today,
      });
      if (!plan) continue;

      for (const week of plan.noticeWeeks) {
        const outcome = await sendAndRecordNotice({
          adminDb,
          agency,
          week,
          daysPastDue: plan.daysPastDue,
        });
        if (outcome === "sent") result.noticesSent += 1;
      }

      if (plan.suspend) {
        await suspendAgency({ adminDb, agency, today });
        result.agenciesSuspended += 1;
      }
    } catch (error) {
      result.errors.push({
        agencyId: agency.id,
        message: error instanceof Error ? error.message : "dunning failed",
      });
    }
  }

  return result;
}
