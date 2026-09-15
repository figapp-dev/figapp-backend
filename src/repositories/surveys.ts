import type { SupabaseClient } from "@supabase/supabase-js";
import { TABLES } from "../lib/tables.js";
import type {
  SurveyQuestionRow,
  SurveyResponseData,
  SurveyResponseRow,
  SurveySendRow,
} from "../types/surveys.js";

const SEND_FIELDS = `
  id,
  agency_id,
  template_id,
  title_override,
  description,
  audience_target,
  recipients_json,
  start_date,
  end_date,
  status,
  is_archived,
  survey_templates (
    id,
    title,
    description
  )
`;

const QUESTION_FIELDS = `
  id,
  survey_id,
  question_text,
  question_type,
  options,
  is_required,
  order_index,
  help_text
`;

const RESPONSE_FIELDS = `
  id,
  agency_id,
  survey_id,
  respondent_id,
  respondent_type,
  response_data,
  is_anonymous,
  started_at,
  completed_at
`;

export async function findAgencyUserContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  agencyId: string | null;
  role: string | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(TABLES.AGENCY_USERS)
    .select("agency_id, role")
    .eq("user_id", userId)
    .eq("is_archived", false)
    .maybeSingle();

  if (error) {
    return { agencyId: null, role: null, error };
  }

  const row = data as { agency_id: string | null; role: string | null } | null;
  return {
    agencyId: row?.agency_id ?? null,
    role: row?.role ?? null,
    error: null,
  };
}

export async function listSurveySendsForAgency(
  supabase: SupabaseClient,
  agencyId: string,
): Promise<{ data: SurveySendRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.SURVEY_SENDS)
    .select(SEND_FIELDS)
    .eq("agency_id", agencyId)
    .order("start_date", { ascending: false });

  return {
    data: ((data as SurveySendRow[] | null) ?? []),
    error,
  };
}

export async function findSurveySendAccessById(
  supabase: SupabaseClient,
  sendId: string,
): Promise<{
  data: Pick<
    SurveySendRow,
    "id" | "agency_id" | "audience_target" | "recipients_json"
  > | null;
  error: Error | null;
}> {
  const { data, error } = await supabase
    .from(TABLES.SURVEY_SENDS)
    .select("id, agency_id, audience_target, recipients_json")
    .eq("id", sendId)
    .maybeSingle();

  return {
    data: (data as Pick<
      SurveySendRow,
      "id" | "agency_id" | "audience_target" | "recipients_json"
    > | null) ?? null,
    error,
  };
}

export async function findSurveySendById(
  supabase: SupabaseClient,
  sendId: string,
): Promise<{ data: SurveySendRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.SURVEY_SENDS)
    .select(SEND_FIELDS)
    .eq("id", sendId)
    .maybeSingle();

  return {
    data: (data as SurveySendRow | null) ?? null,
    error,
  };
}

export async function listResponsesForUserSends(
  supabase: SupabaseClient,
  userId: string,
  sendIds: string[],
): Promise<{ data: SurveyResponseRow[]; error: Error | null }> {
  if (sendIds.length === 0) return { data: [], error: null };

  const { data, error } = await supabase
    .from(TABLES.SURVEY_RESPONSES)
    .select(RESPONSE_FIELDS)
    .eq("respondent_id", userId)
    .in("survey_id", sendIds);

  return {
    data: ((data as SurveyResponseRow[] | null) ?? []),
    error,
  };
}

export async function findResponseForSend(
  supabase: SupabaseClient,
  sendId: string,
  userId: string,
): Promise<{ data: SurveyResponseRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.SURVEY_RESPONSES)
    .select(RESPONSE_FIELDS)
    .eq("survey_id", sendId)
    .eq("respondent_id", userId)
    .maybeSingle();

  return {
    data: (data as SurveyResponseRow | null) ?? null,
    error,
  };
}

export async function findSurveyIdForTemplate(
  supabase: SupabaseClient,
  options: {
    templateId: string | null;
    templateTitle: string | null;
    agencyId: string | null;
  },
): Promise<{ surveyId: string | null; error: Error | null }> {
  if (options.templateId) {
    const { data, error } = await supabase
      .from(TABLES.SURVEYS)
      .select("id")
      .eq("template_id", options.templateId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { surveyId: null, error };
    if (data?.id) return { surveyId: data.id as string, error: null };
  }

  if (options.templateTitle && options.agencyId) {
    const { data, error } = await supabase
      .from(TABLES.SURVEYS)
      .select("id")
      .eq("agency_id", options.agencyId)
      .eq("title", options.templateTitle)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) return { surveyId: null, error };
    if (data?.id) return { surveyId: data.id as string, error: null };
  }

  return { surveyId: null, error: null };
}

export async function listQuestionsForSurvey(
  supabase: SupabaseClient,
  surveyId: string,
): Promise<{ data: SurveyQuestionRow[]; error: Error | null }> {
  const { data, error } = await supabase
    .from(TABLES.SURVEY_QUESTIONS)
    .select(QUESTION_FIELDS)
    .eq("survey_id", surveyId)
    .order("order_index", { ascending: true });

  return {
    data: ((data as SurveyQuestionRow[] | null) ?? []),
    error,
  };
}

export async function insertSurveyResponse(
  supabase: SupabaseClient,
  input: {
    agencyId: string;
    sendId: string;
    userId: string;
    role: string | null;
    responseData: SurveyResponseData;
    isAnonymous: boolean;
    startedAt: string;
  },
): Promise<{ data: SurveyResponseRow | null; error: Error | null }> {
  const now = input.startedAt;
  const { data, error } = await supabase
    .from(TABLES.SURVEY_RESPONSES)
    .insert({
      agency_id: input.agencyId,
      survey_id: input.sendId,
      respondent_id: input.userId,
      respondent_type: input.role,
      response_data: input.responseData,
      is_anonymous: input.isAnonymous,
      started_at: now,
      created_at: now,
      updated_at: now,
    })
    .select(RESPONSE_FIELDS)
    .single();

  return {
    data: (data as SurveyResponseRow | null) ?? null,
    error,
  };
}

export async function updateSurveyResponse(
  supabase: SupabaseClient,
  responseId: string,
  input: {
    responseData: SurveyResponseData;
    isAnonymous: boolean;
    role: string | null;
    startedAt: string | null;
    completedAt?: string | null;
  },
): Promise<{ data: SurveyResponseRow | null; error: Error | null }> {
  const now = new Date().toISOString();
  const patch: Record<string, unknown> = {
    response_data: input.responseData,
    is_anonymous: input.isAnonymous,
    respondent_type: input.role,
    started_at: input.startedAt ?? now,
    updated_at: now,
  };
  if (input.completedAt !== undefined) {
    patch.completed_at = input.completedAt;
  }

  const { data, error } = await supabase
    .from(TABLES.SURVEY_RESPONSES)
    .update(patch)
    .eq("id", responseId)
    .select(RESPONSE_FIELDS)
    .single();

  return {
    data: (data as SurveyResponseRow | null) ?? null,
    error,
  };
}
