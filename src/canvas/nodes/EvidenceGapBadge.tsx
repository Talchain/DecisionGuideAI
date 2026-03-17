/**
 * EvidenceGapBadge — small "?" indicator on factor nodes with no observed data.
 *
 * Positioned absolute bottom-right of the FactorNode outer wrapper, below the
 * existing NodeBadge system which occupies top-right inside BaseNode.
 *
 * The badge is pointer-events-none so it never intercepts node drag/click.
 * Tooltip information is conveyed via aria-label and title for keyboard/hover access.
 *
 * Feature-gated by VITE_FEATURE_GRAPH_BADGES / localStorage['feature.graphBadges'].
 */

import { memo } from 'react'

interface EvidenceGapBadgeProps {
  /** Human-readable label of the factor, used in the accessible tooltip. */
  label: string
}

/**
 * 12px circle badge indicating the factor has no observed data.
 * Appears at bottom-right of the FactorNode outer wrapper.
 */
export const EvidenceGapBadge = memo(function EvidenceGapBadge({ label }: EvidenceGapBadgeProps) {
  const tooltip = `No observed data for "${label}". Setting a value would strengthen the analysis.`

  return (
    <div
      className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-full border border-warning/50 bg-panel
        flex items-center justify-center pointer-events-none"
      style={{ zIndex: 1 }}
      aria-label={tooltip}
      title={tooltip}
      data-testid="evidence-gap-badge"
    >
      <span
        className="text-warning font-bold leading-none select-none"
        style={{ fontSize: '7px' }}
        aria-hidden="true"
      >
        ?
      </span>
    </div>
  )
})
