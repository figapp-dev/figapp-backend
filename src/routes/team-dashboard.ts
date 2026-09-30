import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { bearerSecurity, errorResponses } from "../plugins/swagger.js";
import { getTeamDashboardSummary } from "../services/team-dashboard/summary.js";
import { forbidden, internalError } from "../lib/errors.js";
import { ErrorMessages } from "../constants/error-messages.js";

const teamDashboardResponseSchema = {
  type: "object",
  required: [
    "fosterCarers",
    "households",
    "children",
    "dailyLogsOverdue",
    "documentsToReview",
    "surveysToDo",
  ],
  properties: {
    fosterCarers: { type: "number" },
    households: { type: "number" },
    children: { type: "number" },
    dailyLogsOverdue: { type: "number" },
    documentsToReview: { type: "number" },
    surveysToDo: { type: "number" },
  },
} as const;

export async function teamDashboardRoute(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  app.get(
    "/team-dashboard",
    {
      schema: {
        tags: ["team-dashboard"],
        summary:
          "Team summary for a social_worker/sw_manager's landing screen " +
          "(foster carers, households, children, overdue logs, documents to " +
          "review, surveys to do)",
        security: [...bearerSecurity],
        response: {
          200: teamDashboardResponseSchema,
          ...errorResponses,
        },
      },
    },
    async (request) => {
      const result = await getTeamDashboardSummary(
        request.supabase,
        request.user.id,
      );

      if (result.forbidden) {
        throw forbidden(ErrorMessages.TEAM_DASHBOARD_FORBIDDEN);
      }
      if (result.error || !result.data) {
        request.log.error(result.error);
        throw internalError(ErrorMessages.TEAM_DASHBOARD_LOAD_FAILED);
      }

      return result.data;
    },
  );
}
