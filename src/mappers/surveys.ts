import type {
  SurveyDetailDto,
  SurveyListItemDto,
  SurveyMyResponseSummaryDto,
  SurveyQuestionDto,
  SurveyQuestionRow,
  SurveyQuestionType,
  SurveyReceiverStatus,
  SurveyResponseDto,
  SurveyResponseRow,
  SurveySendRow,
} from "../types/surveys.js";

function norm(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

export function surveyTitle(send: SurveySendRow): string {
  return (
    send.title_override?.trim() ||
    send.survey_templates?.title?.trim() ||
    "Survey"
  );
}

export function surveyDescription(send: SurveySendRow): string | null {
  const fromSend = send.description?.trim();
  if (fromSend) return fromSend;
  const fromTpl = send.survey_templates?.description?.trim();
  return fromTpl || null;
}

export function isSendArchived(send: SurveySendRow): boolean {
  return (
    Boolean(send.is_archived) ||
    norm(send.status) === "archived"
  );
}

export function isAfterEndDate(endDate: string | null | undefined): boolean {
  if (!endDate) return false;
  const end = new Date(endDate);
  if (Number.isNaN(end.getTime())) return false;
  return Date.now() > end.getTime();
}

export function isAssignedToCarer(
  send: Pick<SurveySendRow, "audience_target" | "recipients_json">,
  userId: string,
  role: string | null,
): boolean {
  const myRole = norm(role);
  const audience = Array.isArray(send.audience_target)
    ? send.audience_target.map(norm)
    : [];
  const recipients = Array.isArray(send.recipients_json)
    ? send.recipients_json
    : [];

  const matchesRole = myRole.length > 0 && audience.includes(myRole);
  const matchesUser = recipients.some((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const row = entry as { type?: unknown; value?: unknown };
    return norm(row.type) === "user" && String(row.value ?? "") === userId;
  });

  return matchesRole || matchesUser;
}

export function deriveReceiverStatus(
  send: SurveySendRow,
  response: SurveyResponseRow | null,
): SurveyReceiverStatus {
  if (isSendArchived(send)) return "archived";
  if (isAfterEndDate(send.end_date)) return "ended";
  if (response?.completed_at) return "completed";
  if (response?.started_at || response) return "in_progress";
  return "active";
}

export function deriveCta(
  status: SurveyReceiverStatus,
  hasResponse: boolean,
): string {
  if (status === "archived") return hasResponse ? "View" : "Archived";
  if (status === "ended") return "View";
  if (status === "completed") return "View";
  if (status === "in_progress") return "Continue";
  return "Start";
}

export function normalizeQuestionType(raw: string | null | undefined): SurveyQuestionType {
  const t = norm(raw || "text");
  if (t === "rating_scale" || t === "rating" || t === "score") return "rating_scale";
  if (t === "multiple_choice" || t === "checkbox") return "multiple_choice";
  if (t === "yes_no") return "yes_no";
  if (t === "dropdown" || t === "select" || t === "radio") return "dropdown";
  if (t === "textarea") return "textarea";
  if (t === "date") return "date";
  if (t === "text") return "text";
  return t;
}

export function parseOptions(raw: unknown): string[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed.map(String);
    } catch {
      /* ignore */
    }
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  if (typeof raw === "object" && Array.isArray((raw as { options?: unknown[] }).options)) {
    return ((raw as { options: unknown[] }).options).map(String);
  }
  return [];
}

export function toQuestionDto(row: SurveyQuestionRow): SurveyQuestionDto {
  return {
    id: row.id,
    questionText:
      row.question_text?.trim() ||
      "Question",
    questionType: normalizeQuestionType(row.question_type),
    options: parseOptions(row.options),
    isRequired: Boolean(row.is_required),
    orderIndex: row.order_index ?? 0,
    helpText: row.help_text,
  };
}

export function toMyResponseSummary(
  row: SurveyResponseRow | null,
): SurveyMyResponseSummaryDto | null {
  if (!row) return null;
  return {
    id: row.id,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    isAnonymous: Boolean(row.is_anonymous),
  };
}

export function toResponseDto(row: SurveyResponseRow | null): SurveyResponseDto | null {
  if (!row) return null;
  return {
    id: row.id,
    responseData: row.response_data ?? {},
    isAnonymous: Boolean(row.is_anonymous),
    startedAt: row.started_at,
    completedAt: row.completed_at,
  };
}

export function toListItemDto(
  send: SurveySendRow,
  response: SurveyResponseRow | null,
): SurveyListItemDto {
  const receiverStatus = deriveReceiverStatus(send, response);
  return {
    id: send.id,
    title: surveyTitle(send),
    description: surveyDescription(send),
    startDate: send.start_date,
    endDate: send.end_date,
    sendStatus: send.status ?? "active",
    isArchived: isSendArchived(send),
    receiverStatus,
    cta: deriveCta(receiverStatus, response != null),
    myResponse: toMyResponseSummary(response),
  };
}

export function toDetailDto(params: {
  send: SurveySendRow;
  response: SurveyResponseRow | null;
  questions: SurveyQuestionDto[];
}): SurveyDetailDto {
  const receiverStatus = deriveReceiverStatus(params.send, params.response);
  const ended = isAfterEndDate(params.send.end_date);
  const readOnly =
    isSendArchived(params.send) ||
    ended ||
    Boolean(params.response?.completed_at);

  return {
    id: params.send.id,
    title: surveyTitle(params.send),
    description: surveyDescription(params.send),
    startDate: params.send.start_date,
    endDate: params.send.end_date,
    sendStatus: params.send.status ?? "active",
    isArchived: isSendArchived(params.send),
    ended,
    readOnly,
    receiverStatus,
    cta: deriveCta(receiverStatus, params.response != null),
    questions: params.questions,
    response: toResponseDto(params.response),
  };
}

export function isAnswerEmpty(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === "number") return Number.isNaN(value);
  return false;
}
