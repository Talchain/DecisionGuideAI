/**
 * buildTriageNarrative — Generates a specific coaching sentence for the
 * triage panel narrative line, replacing generic item counts with
 * category-aware descriptions.
 *
 * This is presentation logic, not a semantic transform.
 */

import type { TriageCardCategory } from '@/components/shared/TriageCard'

interface NarrativeItem {
  category: TriageCardCategory
}

/**
 * Build a specific narrative line describing what needs attention.
 *
 * @param items   - All triage items (top3 + quickFix combined)
 * @param hasGoalTarget - Whether a success threshold is set
 * @param coachingSummary - CEE coaching summary (fallback when zero items)
 * @param isLoading - Whether data is still loading
 */
export function buildTriageNarrative(
  items: NarrativeItem[],
  hasGoalTarget: boolean,
  coachingSummary: string | null,
  isLoading: boolean,
): string | null {
  if (isLoading) return null
  if (items.length === 0) {
    if (!coachingSummary) return null
    return !hasGoalTarget
      ? "No success target set, so analysis can't show probability of success. " + coachingSummary
      : coachingSummary
  }

  const missingData = items.filter(a => a.category === 'fix').length
  const estimates = items.filter(a => a.category === 'verify').length
  const edges = items.filter(a => a.category === 'add_evidence').length

  const parts: string[] = []
  if (missingData > 0) parts.push(`${missingData} factor${missingData > 1 ? 's have' : ' has'} no data`)
  if (estimates > 0) parts.push(`${estimates} unverified estimate${estimates > 1 ? 's' : ''}`)
  if (edges > 0) parts.push(`${edges} relationship${edges > 1 ? 's' : ''} worth reviewing`)

  const topN = Math.min(items.length, 3)

  let text: string
  if (parts.length === 0) {
    text = 'Your model looks well-prepared for analysis.'
  } else {
    text = `Top ${topN} by impact: ${parts.join(', ')}`
  }

  if (!hasGoalTarget) {
    text = "No target set. " + text
  }

  return text
}
