export type SurveyReceiverStatus =
  | "active"
  | "in_progress"
  | "completed"
  | "ended"
  | "archived";

export type SurveyQuestionType =
  | "text"
  | "textarea"
  | "date"
  | "yes_no"
  | "dropdown"
  | "multiple_choice"
  | "rating_scale"
  | string;

export type SurveyResponseData = Record<string, unknown>;

export type SurveyMyResponseSummaryDto = {
  id: string;
  startedAt: string | null;
  completedAt: string | null;
  isAnonymous: boolean;
};

export type SurveyListItemDto = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  sendStatus: string;
  isArchived: boolean;
  receiverStatus: SurveyReceiverStatus;
  cta: string;
  myResponse: SurveyMyResponseSummaryDto | null;
};

export type SurveyListDto = {
  items: SurveyListItemDto[];
};

export type SurveyQuestionDto = {
  id: string;
  questionText: string;
  questionType: SurveyQuestionType;
  options: string[];
  isRequired: boolean;
  orderIndex: number;
  helpText: string | null;
};

export type SurveyResponseDto = {
  id: string;
  responseData: SurveyResponseData;
  isAnonymous: boolean;
  startedAt: string | null;
  completedAt: string | null;
};

export type SurveyDetailDto = {
  id: string;
  title: string;
  description: string | null;
  startDate: string | null;
  endDate: string | null;
  sendStatus: string;
  isArchived: boolean;
  ended: boolean;
  readOnly: boolean;
  receiverStatus: SurveyReceiverStatus;
  cta: string;
  questions: SurveyQuestionDto[];
  response: SurveyResponseDto | null;
};

export type SaveSurveyResponseBody = {
  responseData?: SurveyResponseData;
  isAnonymous?: boolean;
};

export type SurveySendRow = {
  id: string;
  agency_id: string;
  template_id: string | null;
  title_override: string | null;
  description: string | null;
  audience_target: string[] | null;
  recipients_json: unknown;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  is_archived: boolean | null;
  survey_templates?: {
    id: string;
    title: string | null;
    description: string | null;
  } | null;
};

export type SurveyQuestionRow = {
  id: string;
  survey_id: string;
  question_text: string | null;
  question_type: string | null;
  options: unknown;
  is_required: boolean | null;
  order_index: number | null;
  help_text: string | null;
};

export type SurveyResponseRow = {
  id: string;
  agency_id: string;
  survey_id: string;
  respondent_id: string;
  respondent_type: string | null;
  response_data: SurveyResponseData | null;
  is_anonymous: boolean | null;
  started_at: string | null;
  completed_at: string | null;
};
