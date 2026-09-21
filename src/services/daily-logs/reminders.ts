import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodayUKDateString } from "../../lib/dates.js";
import { isDailyLogOverdue } from "../../lib/daily-log-status.js";
import { sendMail } from "../../lib/mail.js";
import { env } from "../../config/env.js";
import { findNotificationPreferences } from "../../repositories/notifications.js";

const IN_CHUNK = 100;

function chunkIds(ids: string[]): string[][] {
  const unique = [...new Set(ids.filter(Boolean))];
  const chunks: string[][] = [];
  for (let i = 0; i < unique.length; i += IN_CHUNK) {
    chunks.push(unique.slice(i, i + IN_CHUNK));
  }
  return chunks;
}

function isActiveAgencyUser(row: {
  is_active?: boolean | null;
  status?: string | null;
}): boolean {
  const status = String(row.status ?? "")
    .trim()
    .toLowerCase();
  return row.is_active === true && (status === "" || status === "active");
}

/** ISO week key in Europe/London, e.g. 2026-W12. */
export function ukIsoWeekPeriodKey(onDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(onDate);
  const y = Number(parts.find((p) => p.type === "year")?.value);
  const m = Number(parts.find((p) => p.type === "month")?.value);
  const d = Number(parts.find((p) => p.type === "day")?.value);
  // Thursday-based ISO week (UTC noon avoids DST edge cases).
  const utc = new Date(Date.UTC(y, m - 1, d, 12));
  const day = utc.getUTCDay() || 7;
  utc.setUTCDate(utc.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utc.getUTCFullYear(), 0, 1));
  const week = Math.ceil(
    ((utc.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  );
  return `${utc.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** Calendar month key in Europe/London, e.g. 2026-09. */
export function ukMonthPeriodKey(onDate: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(onDate);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  return `${y}-${m}`;
}

export function countOverdueAssignments(
  rows: Array<{
    assigned_date?: string | null;
    status?: string | null;
  }>,
): number {
  return rows.filter((row) =>
    isDailyLogOverdue({
      assignedDate: row.assigned_date,
      assignmentStatus: row.status,
      logStatus: null,
    }),
  ).length;
}

/**
 * Household IDs reachable from social workers — matches web
 * getSocialWorkerScope / getSwManagerScope foster-carer → household links.
 */
export async function resolveHouseholdIdsForSocialWorkers(
  supabase: SupabaseClient,
  socialWorkerUserIds: string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, Set<string>>();
  for (const id of socialWorkerUserIds) {
    result.set(id, new Set());
  }
  if (socialWorkerUserIds.length === 0) return new Map();

  const carersBySw = new Map<string, Set<string>>();
  for (const id of socialWorkerUserIds) {
    carersBySw.set(id, new Set());
  }

  for (const ids of chunkIds(socialWorkerUserIds)) {
    const { data: agencyCarers, error: carersErr } = await supabase
      .from("agency_users")
      .select("user_id, social_worker_id, is_active, status")
      .in("social_worker_id", ids)
      .eq("role", "foster_carer");
    if (carersErr) throw carersErr;

    for (const row of agencyCarers ?? []) {
      if (!isActiveAgencyUser(row) || !row.user_id || !row.social_worker_id) {
        continue;
      }
      carersBySw.get(row.social_worker_id)?.add(row.user_id);
    }

    const { data: linksBySw, error: linksErr } = await supabase
      .from("household_carers")
      .select("household_id, social_worker_id, user_id")
      .in("social_worker_id", ids)
      .eq("is_active", true);
    if (linksErr) throw linksErr;

    for (const row of linksBySw ?? []) {
      if (!row.social_worker_id) continue;
      if (row.household_id) {
        result.get(row.social_worker_id)?.add(row.household_id);
      }
      if (row.user_id) {
        carersBySw.get(row.social_worker_id)?.add(row.user_id);
      }
    }
  }

  const allCarerIds = [
    ...new Set([...carersBySw.values()].flatMap((set) => [...set])),
  ];

  const carerToHouseholds = new Map<string, string[]>();
  for (const ids of chunkIds(allCarerIds)) {
    const { data: linksByCarer, error } = await supabase
      .from("household_carers")
      .select("household_id, user_id")
      .in("user_id", ids)
      .eq("is_active", true);
    if (error) throw error;

    for (const row of linksByCarer ?? []) {
      if (!row.user_id || !row.household_id) continue;
      const list = carerToHouseholds.get(row.user_id) ?? [];
      list.push(row.household_id);
      carerToHouseholds.set(row.user_id, list);
    }
  }

  for (const [swId, carerIds] of carersBySw) {
    const households = result.get(swId) ?? new Set();
    for (const carerId of carerIds) {
      for (const householdId of carerToHouseholds.get(carerId) ?? []) {
        households.add(householdId);
      }
    }
    result.set(swId, households);
  }

  return new Map(
    [...result.entries()].map(([id, set]) => [id, [...set]]),
  );
}

export async function countOverdueByHouseholdIds(
  supabase: SupabaseClient,
  agencyId: string,
  householdIds: string[],
): Promise<number> {
  if (householdIds.length === 0) return 0;

  const todayUk = getTodayUKDateString();
  let total = 0;

  for (const ids of chunkIds(householdIds)) {
    const { data, error } = await supabase
      .from("daily_log_assignments")
      .select("id, assigned_date, status")
      .eq("agency_id", agencyId)
      .in("household_id", ids)
      .lt("assigned_date", todayUk)
      .neq("status", "completed");
    if (error) throw error;
    total += countOverdueAssignments(data ?? []);
  }

  return total;
}

export type StaffUserRow = {
  user_id: string;
  agency_id: string;
  role: string;
  manager_id: string | null;
};

export async function listActiveStaffByRole(
  supabase: SupabaseClient,
  roles: string[],
): Promise<StaffUserRow[]> {
  const { data, error } = await supabase
    .from("agency_users")
    .select("user_id, agency_id, role, manager_id, is_active, status")
    .in("role", roles)
    .eq("is_active", true);
  if (error) throw error;

  return (data ?? [])
    .filter(isActiveAgencyUser)
    .filter((row) => row.user_id && row.agency_id)
    .map((row) => ({
      user_id: row.user_id as string,
      agency_id: row.agency_id as string,
      role: String(row.role),
      manager_id: (row.manager_id as string | null) ?? null,
    }));
}

type ReminderKind = "weekly_sw" | "monthly_sw_manager";

const SUBTYPE: Record<ReminderKind, string> = {
  weekly_sw: "daily_log_overdue_weekly_sw",
  monthly_sw_manager: "daily_log_overdue_monthly_sw_manager",
};

async function alreadyNotified(
  supabase: SupabaseClient,
  userId: string,
  subtype: string,
  periodKey: string,
): Promise<boolean> {
  // Look back 40 days — enough to cover a month period without scanning forever.
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 40);

  const { data, error } = await supabase
    .from("notifications")
    .select("id, metadata")
    .eq("user_id", userId)
    .gte("created_at", since.toISOString())
    .limit(50);
  if (error) throw error;

  return (data ?? []).some((row) => {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    return (
      meta.notification_subtype === subtype && meta.period_key === periodKey
    );
  });
}

async function userAllowsDailyLogEmail(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc(
      "user_allows_email_notification",
      {
        p_user_id: userId,
        p_category: "daily_logs",
      },
    );
    if (!error && typeof data === "boolean") return data;
  } catch {
    // Fall through to table read.
  }

  const { data } = await findNotificationPreferences(supabase, userId);
  // No prefs row → opt-in default (matches edge preference helpers).
  if (!data) return true;
  return data.email_daily_logs !== false;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

async function sendReminderEmail(
  supabase: SupabaseClient,
  options: {
    userId: string;
    title: string;
    message: string;
  },
): Promise<"sent" | "skipped_prefs" | "skipped_no_email" | "failed"> {
  if (!(await userAllowsDailyLogEmail(supabase, options.userId))) {
    return "skipped_prefs";
  }

  const { data, error } = await supabase
    .from("agency_users")
    .select("email, first_name, last_name")
    .eq("user_id", options.userId)
    .maybeSingle();
  if (error) throw error;

  const email = data?.email?.trim();
  if (!email) return "skipped_no_email";

  const name =
    [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim() ||
    "there";
  const logsUrl = `${env.webAppUrl}/dashboard/daily-logs?filter=overdue`;

  const mail = await sendMail({
    to: email,
    subject: options.title,
    text: [
      `Hello ${name},`,
      "",
      options.message,
      "",
      `Review overdue logs: ${logsUrl}`,
      "",
      "— FigApp",
    ].join("\n"),
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 640px; margin: 0 auto; padding: 20px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
          <h1 style="color: #1a9e4a; margin: 0 0 16px 0;">${escapeHtml(options.title)}</h1>
          <p>Hello ${escapeHtml(name)},</p>
          <p>${escapeHtml(options.message)}</p>
          <div style="text-align: center; margin: 28px 0;">
            <a href="${escapeHtml(logsUrl)}" style="background: #1a9e4a; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">View overdue logs</a>
          </div>
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">This is an automated reminder from FigApp.</p>
        </div>
      </body>
      </html>`,
  });

  if (mail.skipped || !mail.delivered) {
    if (mail.reason) {
      console.warn("daily-log reminder email not sent:", mail.reason);
    }
    return mail.skipped ? "skipped_no_email" : "failed";
  }
  return "sent";
}

async function insertReminder(
  supabase: SupabaseClient,
  options: {
    userId: string;
    title: string;
    message: string;
    kind: ReminderKind;
    periodKey: string;
    overdueCount: number;
    agencyId: string;
  },
): Promise<{ notified: boolean; emailed: boolean }> {
  const subtype = SUBTYPE[options.kind];
  if (
    await alreadyNotified(
      supabase,
      options.userId,
      subtype,
      options.periodKey,
    )
  ) {
    return { notified: false, emailed: false };
  }

  const { error } = await supabase.from("notifications").insert({
    user_id: options.userId,
    title: options.title,
    message: options.message,
    type: "warning",
    action_url: "/dashboard/daily-logs?filter=overdue",
    metadata: {
      notification_subtype: subtype,
      period_key: options.periodKey,
      overdue_count: options.overdueCount,
      agency_id: options.agencyId,
      urgent: true,
    },
  });
  if (error) throw error;

  const emailResult = await sendReminderEmail(supabase, {
    userId: options.userId,
    title: options.title,
    message: options.message,
  });

  return { notified: true, emailed: emailResult === "sent" };
}

export type ReminderRunResult = {
  kind: ReminderKind;
  periodKey: string;
  candidates: number;
  notified: number;
  emailed: number;
  skippedZero: number;
  skippedDuplicate: number;
};

/** Weekly: one reminder per social worker with overdue logs in their caseload. */
export async function runWeeklySocialWorkerReminders(
  supabase: SupabaseClient,
): Promise<ReminderRunResult> {
  const periodKey = ukIsoWeekPeriodKey();
  const socialWorkers = await listActiveStaffByRole(supabase, [
    "social_worker",
  ]);

  const byAgency = new Map<string, StaffUserRow[]>();
  for (const sw of socialWorkers) {
    const list = byAgency.get(sw.agency_id) ?? [];
    list.push(sw);
    byAgency.set(sw.agency_id, list);
  }

  let notified = 0;
  let emailed = 0;
  let skippedZero = 0;
  let skippedDuplicate = 0;

  for (const [agencyId, staff] of byAgency) {
    const householdMap = await resolveHouseholdIdsForSocialWorkers(
      supabase,
      staff.map((s) => s.user_id),
    );

    for (const sw of staff) {
      const households = householdMap.get(sw.user_id) ?? [];
      const overdue = await countOverdueByHouseholdIds(
        supabase,
        agencyId,
        households,
      );
      if (overdue === 0) {
        skippedZero += 1;
        continue;
      }

      const result = await insertReminder(supabase, {
        userId: sw.user_id,
        title: "Overdue daily logs",
        message:
          overdue === 1
            ? "You have 1 overdue daily log that still needs completing."
            : `You have ${overdue} overdue daily logs that still need completing.`,
        kind: "weekly_sw",
        periodKey,
        overdueCount: overdue,
        agencyId,
      });
      if (result.notified) {
        notified += 1;
        if (result.emailed) emailed += 1;
      } else {
        skippedDuplicate += 1;
      }
    }
  }

  return {
    kind: "weekly_sw",
    periodKey,
    candidates: socialWorkers.length,
    notified,
    emailed,
    skippedZero,
    skippedDuplicate,
  };
}

/**
 * Monthly: one reminder per SW manager with overdue logs across their
 * managed social workers' caseloads (web getSwManagerScope).
 */
export async function runMonthlySwManagerReminders(
  supabase: SupabaseClient,
): Promise<ReminderRunResult> {
  const periodKey = ukMonthPeriodKey();
  const managers = await listActiveStaffByRole(supabase, [
    "sw_manager",
    "social_worker_manager",
    "social_work_manager",
  ]);
  const socialWorkers = await listActiveStaffByRole(supabase, [
    "social_worker",
  ]);

  const swsByManager = new Map<string, string[]>();
  for (const sw of socialWorkers) {
    if (!sw.manager_id) continue;
    const list = swsByManager.get(sw.manager_id) ?? [];
    list.push(sw.user_id);
    swsByManager.set(sw.manager_id, list);
  }

  let notified = 0;
  let emailed = 0;
  let skippedZero = 0;
  let skippedDuplicate = 0;

  for (const manager of managers) {
    const managedSwIds = swsByManager.get(manager.user_id) ?? [];
    if (managedSwIds.length === 0) {
      skippedZero += 1;
      continue;
    }

    // Manager foster-carer scope on web uses agency_users.social_worker_id only
    // (not household_carers SW links) — mirror that via carers from agency rows.
    const { data: agencyCarers, error: carersErr } = await supabase
      .from("agency_users")
      .select("user_id, is_active, status")
      .in("social_worker_id", managedSwIds)
      .eq("role", "foster_carer");
    if (carersErr) throw carersErr;

    const carerIds = (agencyCarers ?? [])
      .filter(isActiveAgencyUser)
      .map((r) => r.user_id as string)
      .filter(Boolean);

    const householdIds = new Set<string>();
    for (const ids of chunkIds(carerIds)) {
      const { data: links, error } = await supabase
        .from("household_carers")
        .select("household_id")
        .in("user_id", ids)
        .eq("is_active", true);
      if (error) throw error;
      for (const row of links ?? []) {
        if (row.household_id) householdIds.add(row.household_id);
      }
    }

    const overdue = await countOverdueByHouseholdIds(
      supabase,
      manager.agency_id,
      [...householdIds],
    );
    if (overdue === 0) {
      skippedZero += 1;
      continue;
    }

    const result = await insertReminder(supabase, {
      userId: manager.user_id,
      title: "Monthly overdue daily logs",
      message:
        overdue === 1
          ? "Your team has 1 overdue daily log this month."
          : `Your team has ${overdue} overdue daily logs this month.`,
      kind: "monthly_sw_manager",
      periodKey,
      overdueCount: overdue,
      agencyId: manager.agency_id,
    });
    if (result.notified) {
      notified += 1;
      if (result.emailed) emailed += 1;
    } else {
      skippedDuplicate += 1;
    }
  }

  return {
    kind: "monthly_sw_manager",
    periodKey,
    candidates: managers.length,
    notified,
    emailed,
    skippedZero,
    skippedDuplicate,
  };
}
