import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceFailure, serviceSuccess } from "../../lib/service-result.js";
import {
  isAnswerEmpty,
  isAssignedToCarer,
  toDetailDto,
  toListItemDto,
  toQuestionDto,
} from "../../mappers/surveys.js";
import {
  findAgencyUserContext,
  findResponseForSend,
  findSurveyIdForTemplate,
  findSurveySendAccessById,
  findSurveySendById,
  insertSurveyResponse,
  listQuestionsForSurvey,
  listResponsesForUserSends,
  listSurveySendsForAgency,
  updateSurveyResponse,
} from "../../repositories/surveys.js";
import type {
  SaveSurveyResponseBody,
  SurveyDetailDto,
  SurveyListDto,
  SurveyListItemDto,
  SurveyReceiverStatus,
  SurveyResponseData,
} from "../../types/surveys.js";

function normalizeResponseData(raw: unknown): SurveyResponseData {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  return raw as SurveyResponseData;
}

async function loadQuestionsForSend(
  supabase: SupabaseClient,
  send: Awaited<ReturnType<typeof findSurveySendById>>["data"],
) {
  if (!send) return { questions: [], error: null as Error | null };

  const templateTitle =
    send.survey_templates?.title ?? send.title_override ?? null;
  const surveyRef = await findSurveyIdForTemplate(supabase, {
    templateId: send.template_id,
    templateTitle,
    agencyId: send.agency_id,
  });
  if (surveyRef.error) return { questions: [], error: surveyRef.error };
  if (!surveyRef.surveyId) return { questions: [], error: null };

  const questions = await listQuestionsForSurvey(supabase, surveyRef.surveyId);
  if (questions.error) return { questions: [], error: questions.error };

  return {
    questions: questions.data.map(toQuestionDto),
    error: null,
  };
}

export async function listSurveysForCarer(
  supabase: SupabaseClient,
  userId: string,
  options?: { status?: SurveyReceiverStatus; q?: string },
) {
  const ctx = await findAgencyUserContext(supabase, userId);
  if (ctx.error) return serviceFailure({ error: ctx.error });
  if (!ctx.agencyId) {
    return serviceSuccess<SurveyListDto>({ items: [] });
  }

  const sends = await listSurveySendsForAgency(supabase, ctx.agencyId);
  if (sends.error) return serviceFailure({ error: sends.error });

  const assigned = sends.data.filter((send) =>
    isAssignedToCarer(send, userId, ctx.role),
  );
  const sendIds = assigned.map((s) => s.id);
  const responses = await listResponsesForUserSends(supabase, userId, sendIds);
  if (responses.error) return serviceFailure({ error: responses.error });

  const bySend = new Map(responses.data.map((r) => [r.survey_id, r]));
  let items: SurveyListItemDto[] = assigned.map((send) =>
    toListItemDto(send, bySend.get(send.id) ?? null),
  );

  if (options?.status) {
    items = items.filter((item) => item.receiverStatus === options.status);
  }

  const q = options?.q?.trim().toLowerCase();
  if (q) {
    items = items.filter((item) => item.title.toLowerCase().includes(q));
  }

  return serviceSuccess<SurveyListDto>({ items });
}

export async function getSurveyForCarer(
  supabase: SupabaseClient,
  userId: string,
  sendId: string,
) {
  const id = sendId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const ctx = await findAgencyUserContext(supabase, userId);
  if (ctx.error) return serviceFailure({ error: ctx.error });
  if (!ctx.agencyId) return serviceFailure({ forbidden: true });

  // Lean ACL probe first (no template join) so unassigned sends 403 quickly.
  const access = await findSurveySendAccessById(supabase, id);
  if (access.error) return serviceFailure({ error: access.error });
  if (!access.data || access.data.agency_id !== ctx.agencyId) {
    return serviceFailure({ notFound: true });
  }
  if (!isAssignedToCarer(access.data, userId, ctx.role)) {
    return serviceFailure({ forbidden: true });
  }

  const send = await findSurveySendById(supabase, id);
  if (send.error) return serviceFailure({ error: send.error });
  if (!send.data || send.data.agency_id !== ctx.agencyId) {
    return serviceFailure({ notFound: true });
  }

  const [response, questions] = await Promise.all([
    findResponseForSend(supabase, id, userId),
    loadQuestionsForSend(supabase, send.data),
  ]);
  if (response.error) return serviceFailure({ error: response.error });
  if (questions.error) return serviceFailure({ error: questions.error });

  return serviceSuccess<SurveyDetailDto>(
    toDetailDto({
      send: send.data,
      response: response.data,
      questions: questions.questions,
    }),
  );
}

async function saveResponse(
  supabase: SupabaseClient,
  userId: string,
  sendId: string,
  body: SaveSurveyResponseBody,
  options: { submit: boolean },
) {
  const id = sendId.trim();
  if (!id) return serviceFailure({ badRequest: true });

  const ctx = await findAgencyUserContext(supabase, userId);
  if (ctx.error) return serviceFailure({ error: ctx.error });
  if (!ctx.agencyId) {
    return serviceFailure({
      badRequest: true,
      error: new Error("agency"),
    });
  }

  const send = await findSurveySendById(supabase, id);
  if (send.error) return serviceFailure({ error: send.error });
  if (!send.data || send.data.agency_id !== ctx.agencyId) {
    return serviceFailure({ notFound: true });
  }
  if (!isAssignedToCarer(send.data, userId, ctx.role)) {
    return serviceFailure({ forbidden: true });
  }

  const existing = await findResponseForSend(supabase, id, userId);
  if (existing.error) return serviceFailure({ error: existing.error });
  if (existing.data?.completed_at) {
    return serviceFailure({ notEditable: true });
  }

  const probe = toDetailDto({
    send: send.data,
    response: existing.data,
    questions: [],
  });
  if (probe.isArchived || probe.ended) {
    return serviceFailure({ notEditable: true });
  }

  const questions = await loadQuestionsForSend(supabase, send.data);
  if (questions.error) return serviceFailure({ error: questions.error });
  if (questions.questions.length === 0) {
    return serviceFailure({ badRequest: true });
  }

  const responseData = normalizeResponseData(body.responseData);
  const isAnonymous = Boolean(body.isAnonymous);

  if (options.submit) {
    const missing = questions.questions.filter(
      (q) => q.isRequired && isAnswerEmpty(responseData[q.id]),
    );
    if (missing.length > 0) {
      return serviceFailure({
        validationFailed: true,
        missingFieldIds: missing.map((q) => q.id),
      });
    }
  }

  const now = new Date().toISOString();
  let saved = existing.data;

  if (!saved) {
    const inserted = await insertSurveyResponse(supabase, {
      agencyId: ctx.agencyId,
      sendId: id,
      userId,
      role: ctx.role,
      responseData,
      isAnonymous,
      startedAt: now,
    });
    if (inserted.error || !inserted.data) {
      return serviceFailure({
        error: inserted.error ?? new Error("Failed to create survey response"),
      });
    }
    saved = inserted.data;
  } else {
    const updated = await updateSurveyResponse(supabase, saved.id, {
      responseData,
      isAnonymous,
      role: ctx.role,
      startedAt: saved.started_at ?? now,
    });
    if (updated.error || !updated.data) {
      return serviceFailure({
        error: updated.error ?? new Error("Failed to update survey response"),
      });
    }
    saved = updated.data;
  }

  if (options.submit) {
    const submitted = await updateSurveyResponse(supabase, saved.id, {
      responseData,
      isAnonymous,
      role: ctx.role,
      startedAt: saved.started_at ?? now,
      completedAt: now,
    });
    if (submitted.error || !submitted.data) {
      return serviceFailure({
        error: submitted.error ?? new Error("Failed to submit survey response"),
      });
    }
    saved = submitted.data;
  }

  return serviceSuccess(
    toDetailDto({
      send: send.data,
      response: saved,
      questions: questions.questions,
    }),
  );
}

export async function saveSurveyDraftForCarer(
  supabase: SupabaseClient,
  userId: string,
  sendId: string,
  body: SaveSurveyResponseBody,
) {
  return saveResponse(supabase, userId, sendId, body, { submit: false });
}

export async function submitSurveyForCarer(
  supabase: SupabaseClient,
  userId: string,
  sendId: string,
  body: SaveSurveyResponseBody,
) {
  return saveResponse(supabase, userId, sendId, body, { submit: true });
}
