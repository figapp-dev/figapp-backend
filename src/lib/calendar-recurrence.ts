/** Recurrence is expanded into individual `events` rows at write time (mirrors
 * the web app's client-side expansion in modules/events/components/AddEventDialog.tsx),
 * not computed on read. Rows share a `series_id` and are ordered by `occurrence_index`. */

export type RecurrenceUnit = "days" | "weeks" | "months" | "years";

export type RecurrenceEnd =
  | { type: "never" }
  | { type: "after"; count: number }
  | { type: "until"; until: string };

export type RecurrencePattern = {
  repeat: {
    every: number;
    unit: RecurrenceUnit;
    end: RecurrenceEnd;
  };
};

/** Web caps "never"-ending series at 52 generated occurrences; mirror that here. */
export const MAX_RECURRENCE_OCCURRENCES = 52;

export type RecurrenceOccurrence = {
  occurrenceIndex: number;
  startDatetime: string;
  endDatetime: string;
};

function advance(date: Date, step: number, unit: RecurrenceUnit): Date {
  const next = new Date(date);
  switch (unit) {
    case "days":
      next.setUTCDate(next.getUTCDate() + step);
      break;
    case "weeks":
      next.setUTCDate(next.getUTCDate() + step * 7);
      break;
    case "months":
      next.setUTCMonth(next.getUTCMonth() + step);
      break;
    case "years":
      next.setUTCFullYear(next.getUTCFullYear() + step);
      break;
  }
  return next;
}

/** Expands a start/end datetime + optional recurrence pattern into occurrence
 * rows. A null/non-recurring pattern always returns exactly one occurrence
 * (occurrenceIndex 1), matching `events.occurrence_index`'s `DEFAULT 1 NOT NULL`. */
export function expandRecurrence(
  startDatetime: string,
  endDatetime: string,
  pattern: RecurrencePattern | null,
  maxOccurrences: number = MAX_RECURRENCE_OCCURRENCES,
): RecurrenceOccurrence[] {
  const start = new Date(startDatetime);
  const end = new Date(endDatetime);
  const durationMs = end.getTime() - start.getTime();

  if (!pattern) {
    return [
      {
        occurrenceIndex: 1,
        startDatetime: start.toISOString(),
        endDatetime: end.toISOString(),
      },
    ];
  }

  const { every, unit, end: recurrenceEnd } = pattern.repeat;
  const step = Math.max(1, Math.floor(every) || 1);
  const countLimit =
    recurrenceEnd.type === "after"
      ? Math.max(1, Math.floor(recurrenceEnd.count))
      : null;
  const untilMs =
    recurrenceEnd.type === "until" ? new Date(recurrenceEnd.until).getTime() : null;

  const occurrences: RecurrenceOccurrence[] = [];
  let cursor = start;
  let index = 1;

  while (index <= maxOccurrences) {
    if (countLimit !== null && index > countLimit) break;
    if (untilMs !== null && cursor.getTime() > untilMs) break;

    occurrences.push({
      occurrenceIndex: index,
      startDatetime: cursor.toISOString(),
      endDatetime: new Date(cursor.getTime() + durationMs).toISOString(),
    });

    cursor = advance(cursor, step, unit);
    index += 1;
  }

  return occurrences;
}

/** A client-supplied "until" is usually a date picker value (`YYYY-MM-DD`,
 * no time-of-day) — treat it as end-of-day so the occurrence that lands on
 * that calendar date is still included, rather than being excluded because
 * its own start time (e.g. 09:00) is later than an implicit midnight. */
export function normalizeRecurrencePattern(
  pattern: RecurrencePattern,
): RecurrencePattern {
  if (pattern.repeat.end.type !== "until") return pattern;
  const { until } = pattern.repeat.end;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return pattern;

  return {
    repeat: {
      ...pattern.repeat,
      end: { type: "until", until: `${until}T23:59:59.999Z` },
    },
  };
}

/** Structural validation only (shape/range) — does not know about "today". */
export function isValidRecurrencePattern(value: unknown): value is RecurrencePattern {
  if (!value || typeof value !== "object") return false;
  const repeat = (value as RecurrencePattern).repeat;
  if (!repeat || typeof repeat !== "object") return false;

  if (!Number.isFinite(repeat.every) || repeat.every < 1) return false;
  if (!["days", "weeks", "months", "years"].includes(repeat.unit)) return false;

  const end = repeat.end;
  if (!end || typeof end !== "object") return false;
  if (end.type === "never") return true;
  if (end.type === "after") {
    return Number.isFinite(end.count) && end.count >= 1;
  }
  if (end.type === "until") {
    return typeof end.until === "string" && !Number.isNaN(Date.parse(end.until));
  }
  return false;
}
