/**
 * Age helpers shared with FigApp web rules.
 *
 * Used by GET /children so under-18 biological parents can appear
 * on the carer list as "Parent Child" rows (same as the web Children page).
 */
/**
 * Calculates whole years of age from a date of birth.
 *
 * - Returns null if DOB is missing or invalid.
 * - Subtracts 1 year if the birthday has not occurred yet in the current year.
 *
 * Example: DOB 2010-12-20 on 2026-08-07 → 15 (not 16 yet).
 */
export function calculateAgeYears(
  dateOfBirth: string | null | undefined,
  onDate: Date = new Date(),
): number | null {
  if (!dateOfBirth) return null;

  const birth = new Date(dateOfBirth);
  if (Number.isNaN(birth.getTime())) return null;

  let age = onDate.getFullYear() - birth.getFullYear();
  const monthDiff = onDate.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff == 0 && onDate.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function isBiologicalParentUnder18(
  dateOfBirth: string | null | undefined,
) {
  const age = calculateAgeYears(dateOfBirth);
  if (age == null) return false;
  return age > 0 && age <= 18;
}
