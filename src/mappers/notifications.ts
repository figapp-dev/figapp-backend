import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  type NotificationDto,
  type NotificationPreferencesDto,
  type NotificationPreferencesRow,
  type NotificationRow,
} from "../types/notifications.js";

export function toNotificationDto(row: NotificationRow): NotificationDto {
  return {
    id: row.id,
    title: row.title,
    message: row.message,
    type: row.type,
    readAt: row.read_at,
    actionUrl: row.action_url,
    metadata:
      row.metadata && typeof row.metadata === "object" ? row.metadata : {},
    agencyId: row.agency_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function toNotificationPreferencesDto(
  row: NotificationPreferencesRow | null,
): NotificationPreferencesDto {
  if (!row) return { ...DEFAULT_NOTIFICATION_PREFERENCES };
  return {
    emailDailyLogs: row.email_daily_logs,
    emailAiInsights: row.email_ai_insights,
    emailDocumentDeadlines: row.email_document_deadlines,
    emailSystemMaintenance: row.email_system_maintenance,
    emailTasks: row.email_tasks,
    emailTickets: row.email_tickets,
    emailEvents: row.email_events,
    emailSurveys: row.email_surveys,
    pushUrgentOnly: row.push_urgent_only,
    pushAll: row.push_all,
  };
}

export function preferencesDtoToRow(
  userId: string,
  dto: NotificationPreferencesDto,
) {
  return {
    user_id: userId,
    email_daily_logs: dto.emailDailyLogs,
    email_ai_insights: dto.emailAiInsights,
    email_document_deadlines: dto.emailDocumentDeadlines,
    email_system_maintenance: dto.emailSystemMaintenance,
    email_tasks: dto.emailTasks,
    email_tickets: dto.emailTickets,
    email_events: dto.emailEvents,
    email_surveys: dto.emailSurveys,
    push_urgent_only: dto.pushUrgentOnly,
    push_all: dto.pushAll,
    updated_at: new Date().toISOString(),
  };
}
