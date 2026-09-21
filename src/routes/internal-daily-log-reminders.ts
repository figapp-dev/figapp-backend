import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { secretsEqual } from "../lib/secrets.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import { internalError, unauthorized } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";
import { errorResponses } from "../plugins/swagger.js";
import {
  runMonthlySwManagerReminders,
  runWeeklySocialWorkerReminders,
} from "../services/daily-logs/reminders.js";

function headerValue(
  value: string | string[] | undefined,
): string | undefined {
  const raw = Array.isArray(value) ? value[0] : value;
  const trimmed = raw?.trim();
  return trimmed || undefined;
}

function cronSecretFromRequest(headers: {
  authorization?: string | string[];
  "x-cron-secret"?: string | string[];
  "x-billing-cron-secret"?: string | string[];
}): string | undefined {
  const fromHeader =
    headerValue(headers["x-cron-secret"]) ||
    headerValue(headers["x-billing-cron-secret"]);
  if (fromHeader) return fromHeader;
  const auth = headerValue(headers.authorization);
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice("Bearer ".length).trim();
    return token || undefined;
  }
  return undefined;
}

function assertCronAuthorized(headers: {
  authorization?: string | string[];
  "x-cron-secret"?: string | string[];
  "x-billing-cron-secret"?: string | string[];
}) {
  if (!env.cronSecret) {
    throw internalError(ErrorMessages.CRON_NOT_CONFIGURED);
  }
  if (!secretsEqual(cronSecretFromRequest(headers), env.cronSecret)) {
    throw unauthorized(ErrorMessages.CRON_UNAUTHORIZED);
  }
}

/** GitHub Actions / Railway cron — not a user JWT route. */
export async function dailyLogRemindersRoute(app: FastifyInstance) {
  app.post(
    "/internal/daily-logs/remind-social-workers",
    {
      schema: {
        tags: ["daily-logs"],
        summary: "Weekly overdue daily-log reminders for social workers",
        description:
          "Counts overdue assignments in each SW caseload and inserts a " +
          "notification when the count is > 0. Header x-cron-secret " +
          "(or x-billing-cron-secret / Bearer) must match CRON_SECRET " +
          "or BILLING_CRON_SECRET.",
        response: {
          200: {
            type: "object",
            additionalProperties: true,
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      assertCronAuthorized(request.headers);
      try {
        const supabase = createServiceRoleClient();
        return await runWeeklySocialWorkerReminders(supabase);
      } catch (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOG_REMINDERS_FAILED);
      }
    },
  );

  app.post(
    "/internal/daily-logs/remind-sw-managers",
    {
      schema: {
        tags: ["daily-logs"],
        summary: "Monthly overdue daily-log reminders for SW managers",
        description:
          "Counts overdue assignments across each manager's team and inserts " +
          "a notification when the count is > 0. Same cron secret as weekly.",
        response: {
          200: {
            type: "object",
            additionalProperties: true,
          },
          ...errorResponses,
        },
      },
    },
    async (request) => {
      assertCronAuthorized(request.headers);
      try {
        const supabase = createServiceRoleClient();
        return await runMonthlySwManagerReminders(supabase);
      } catch (error) {
        request.log.error(error);
        throw internalError(ErrorMessages.DAILY_LOG_REMINDERS_FAILED);
      }
    },
  );
}
