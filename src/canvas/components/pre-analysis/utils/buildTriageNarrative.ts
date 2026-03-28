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
 * @param coachingSummary - CEE coaching summary (takes priority when present)
 * @param isLoading - Whether data is still loading
 */
export function buildTriageNarrative(
  items: NarrativeItem[],
  hasGoalTarget: boolean,
  coachingSummary: string | null,
  isLoading: boolean,
): string | null {
  if (isLoading || items.length === 0) return null
  if (coachingSummary) return coachingSummary

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
    text = topN === 1
      ? `${parts.join(' and ')}. This 1 covers the highest impact:`
      : `${parts.join(' and ')}. These ${topN} cover the highest impact:`
  }

  if (!hasGoalTarget) {
    text = "No success target set, so analysis can't show probability of success. " + text
  }

  return text
}
