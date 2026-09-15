export type NotificationType = "info" | "warning" | "error" | "success";

export type NotificationListFilter = "all" | "unread";

export type NotificationRow = {
  id: string;
  user_id: string;
  title: string;
  message: string | null;
  type: string;
  read_at: string | null;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  agency_id: string | null;
  created_at: string;
  updated_at: string;
};

export type NotificationDto = {
  id: string;
  title: string;
  message: string | null;
  type: string;
  readAt: string | null;
  actionUrl: string | null;
  metadata: Record<string, unknown>;
  agencyId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type NotificationListDto = {
  notifications: NotificationDto[];
  unreadCount: number;
};

export type NotificationPreferencesRow = {
  user_id: string;
  email_daily_logs: boolean;
  email_ai_insights: boolean;
  email_document_deadlines: boolean;
  email_system_maintenance: boolean;
  email_tasks: boolean;
  email_tickets: boolean;
  email_events: boolean;
  email_surveys: boolean;
  push_urgent_only: boolean;
  push_all: boolean;
};

export type NotificationPreferencesDto = {
  emailDailyLogs: boolean;
  emailAiInsights: boolean;
  emailDocumentDeadlines: boolean;
  emailSystemMaintenance: boolean;
  emailTasks: boolean;
  emailTickets: boolean;
  emailEvents: boolean;
  emailSurveys: boolean;
  pushUrgentOnly: boolean;
  pushAll: boolean;
};

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferencesDto = {
  emailDailyLogs: true,
  emailAiInsights: true,
  emailDocumentDeadlines: true,
  emailSystemMaintenance: false,
  emailTasks: true,
  emailTickets: true,
  emailEvents: true,
  emailSurveys: true,
  pushUrgentOnly: true,
  pushAll: false,
};
