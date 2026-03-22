/**
 * ConstraintBadge — small target icon on factor nodes referenced by goal_constraints.
 *
 * Positioned absolute bottom-left of the FactorNode outer wrapper, complementing
 * EvidenceGapBadge at bottom-right.
 *
 * The visual badge is pointer-events-none so it never intercepts node drag/click.
 * A slightly larger transparent hover zone sits on top to make the native title
 * tooltip accessible on hover without interfering with drag.
 *
 * Feature-gated by VITE_FEATURE_GRAPH_BADGES / localStorage['feature.graphBadges'].
 */

import { memo } from 'react'
import { Target } from 'lucide-react'

interface ConstraintBadgeProps {
  /** Tooltip describing the constraint(s) on this factor. */
  tooltip: string
}

/**
 * 12px circle badge indicating the factor is referenced by a goal constraint.
 * Appears at bottom-left of the FactorNode outer wrapper.
 */
export const ConstraintBadge = memo(function ConstraintBadge({ tooltip }: ConstraintBadgeProps) {
  return (
    <>
      {/* Visual badge — pointer-events-none for drag safety */}
      <div
        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-full border border-info/50 bg-panel
          flex items-center justify-center pointer-events-none"
        style={{ zIndex: 1 }}
        aria-hidden="true"
        data-testid="constraint-badge"
      >
        <Target
          size={7}
          className="text-info"
          aria-hidden="true"
        />
      </div>
      {/* Transparent hover zone — carries tooltip and accessible label */}
      <div
        className="absolute -bottom-2.5 -left-2.5 w-5 h-5 rounded-full"
        style={{ zIndex: 2 }}
        title={tooltip}
        aria-label={tooltip}
        data-testid="constraint-badge-hover"
      />
    </>
  )
})
