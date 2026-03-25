/**
 * ResultsFooter — metadata row showing stability, addressed count, and influence.
 *
 * Renders inside the scroll container (not sticky) with the same 56px height
 * as the previous spacer, providing footer clearance.
 */

import { typography } from '../../styles/typography'
import Tooltip from '../Tooltip'

export interface ResultsFooterProps {
  /** Recommendation stability (0-1) */
  stability?: number | null
  /** Number of resolved action items */
  resolvedCount: number
  /** Total must_fix + should_fix items */
  totalCount: number
  /** Cumulative normalised influence of resolved factors (0-1), omit when unavailable */
  influencePct?: number | null
}

export function ResultsFooter({
  stability,
  resolvedCount,
  totalCount,
  influencePct,
}: ResultsFooterProps) {
  const stabilityPct = stability != null ? Math.round(stability * 100) : null

  const parts: string[] = []
  if (stabilityPct != null) parts.push(`${stabilityPct}% stability`)
  parts.push(`${resolvedCount}/${totalCount} addressed`)
  if (influencePct != null) parts.push(`${Math.round(influencePct * 100)}% of influence`)

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
