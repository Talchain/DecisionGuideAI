/**
 * buildTriageNarrative — Generates a one-line coaching subtitle for the
 * "Strengthen your model" triage section.
 *
 * This is presentation logic, not a semantic transform.
 */

import type { TriageCardCategory } from '@/components/shared/TriageCard'

interface NarrativeItem {
  category: TriageCardCategory
  /** Factor label (for "highest-impact item" suffix) */
  title?: string
}

/**
 * Build a one-line coaching subtitle.
 *
 * @param items   - All triage items (top3 + quickFix combined)
 * @param hasGoalTarget - Whether a success threshold is set
 * @param topFactorName - Label of the highest-impact factor (optional)
 * @param isLoading - Whether data is still loading
 */
export function buildTriageNarrative(
  items: NarrativeItem[],
  hasGoalTarget: boolean,
  topFactorName: string | null,
  isLoading: boolean,
): string | null {
  if (isLoading) return null
  if (items.length === 0) {
    return hasGoalTarget
      ? 'Your model looks well-prepared for analysis'
      : 'Set a target and review these items before running analysis'
  }

  if (!hasGoalTarget) {
    let text = 'Set a target and review these items before running analysis'
    if (topFactorName) text += `. Highest-impact: ${topFactorName}`
    return text
  }

  if (topFactorName) {
    return `Highest-impact item: ${topFactorName}`
  }

  return null
}
