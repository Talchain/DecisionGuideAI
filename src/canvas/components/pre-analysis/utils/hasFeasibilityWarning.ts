/**
 * Single source of truth for feasibility warning detection.
 * Used by both usePreAnalysisData hook and SuccessTarget component.
 */

const FEASIBILITY_CODES = new Set([
  'CONSTRAINT_MISSING_RANGE',
  'CONSTRAINT_NEAR_BOUND',
  'GOAL_THRESHOLD_EXCEEDS_RANGE',
])

export function hasFeasibilityWarning(
  critiques: Array<{ code?: string; message?: string }> | undefined | null,
): boolean {
  if (!critiques || critiques.length === 0) return false
  return critiques.some(c => c.code != null && FEASIBILITY_CODES.has(c.code))
}
