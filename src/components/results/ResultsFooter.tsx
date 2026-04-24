/**
 * ResultsFooter — metadata row showing stability and influence.
 *
 * Renders inside the scroll container (not sticky) with the same 56px height
 * as the previous spacer, providing footer clearance.
 */

import { typography } from '../../styles/typography'
import { getStabilityClassification } from '../../lib/stability'
import { getStabilityDisplayLabel } from './utils/getStabilityDisplayLabel'
import type { ConfidenceTier } from './types'
import type { M1CoachingReadiness } from '../../types/cee'
import Tooltip from '../Tooltip'

export interface ResultsFooterProps {
  /** Recommendation stability (0-1) */
  stability?: number | null
  /** Cumulative normalised influence of resolved factors (0-1), omit when unavailable */
  influencePct?: number | null
  /**
   * Brief 5.2 Task 1: weak tier forces "Stability sensitive" even at high
   * numeric stability. Without these, an evidence-weak analysis with
   * stability 0.97 reads as "Stable result · 97%" — over-confident.
   */
  confidenceTier?: ConfidenceTier
  coachingReadiness?: M1CoachingReadiness
}

export function ResultsFooter({
  stability,
  influencePct,
  confidenceTier,
  coachingReadiness,
}: ResultsFooterProps) {
  const stabilityPct = stability != null ? Math.round(stability * 100) : null
  const classification = getStabilityClassification(stability ?? null)
  const displayLabel = getStabilityDisplayLabel({
    classification,
    confidenceTier,
    coachingReadiness,
    recommendationStability: stability,
  })
  const stabilityLabel = displayLabel?.heroLabel

  const parts: string[] = []
  if (stabilityLabel) parts.push(stabilityLabel)
  if (influencePct != null) parts.push(`${Math.round(influencePct * 100)}% of influence`)
  if (stabilityPct != null) parts.push(`${stabilityPct}%`)

  return (
    <div
      className="flex items-center justify-center py-3"
      style={{ minHeight: 56 }}
      data-testid="results-footer"
      aria-hidden="true"
    >
      <Tooltip content="Weighted by impact on the decision outcome">
        <span className={`${typography.panelMeta} text-text-light`}>
          {parts.join(' \u00B7 ')}
        </span>
      </Tooltip>
    </div>
  )
}
