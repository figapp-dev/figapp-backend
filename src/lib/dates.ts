/** Calendar date in UK (Europe/London) as YYYY-MM-DD. */
export function getTodayUKDateString(onDate: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(onDate);
}

/** Normalize a date-ish string to YYYY-MM-DD, or null if invalid. */
export function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  const key = String(value).trim().slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : null;
}

/** Compare optimistic-lock timestamps (ISO strings).
 * Empty expected is treated as "no lock provided" (match).
 * Callers that require a lock when a row exists must check emptiness first.
 */
export function timestampsMatch(
  expected: string | null | undefined,
  actual: string | null | undefined,
): boolean {
  if (expected == null || String(expected).trim() === "") return true;
  if (actual == null || String(actual).trim() === "") return false;

  const expectedMs = Date.parse(String(expected).trim());
  const actualMs = Date.parse(String(actual).trim());
  if (Number.isNaN(expectedMs) || Number.isNaN(actualMs)) {
    return String(expected).trim() === String(actual).trim();
  }
  return expectedMs === actualMs;
}
