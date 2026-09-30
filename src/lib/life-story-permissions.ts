/**
 * Who may add a Life Story entry for a child — mirrors web's
 * `canAdd={userRole !== "social_worker"}` in ChildProfileDialog.tsx exactly:
 * foster_carer and sw_manager can add entries, plain social_worker is
 * view-only (still gets the read + PDF-download affordance, just not this).
 */
export function canRoleAddLifeStoryEntry(role: string | null | undefined): boolean {
  return role !== "social_worker";
}
