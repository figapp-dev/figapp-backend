/** Preferred → full name → legal name, matching web child display rules. */
export function buildChildDisplayName(row: {
  preferred_name?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  legal_name?: string | null;
}): string {
  if (row.preferred_name?.trim()) {
    return row.preferred_name.trim();
  }

  const parts = [row.first_name, row.middle_name, row.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

  if (parts) return parts;
  return row.legal_name?.trim() || "Unknown child";
}
