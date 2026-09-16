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
import { CANVAS_CORNER_OFFSET_CLASSES_LEFT, CANVAS_GLYPH_SIZE_CLASSES } from './shared/canvasGlyphScale'

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
        className={`absolute ${CANVAS_CORNER_OFFSET_CLASSES_LEFT[6]} ${CANVAS_GLYPH_SIZE_CLASSES[12]} rounded-full border border-info/50 bg-panel
          flex items-center justify-center pointer-events-none`}
        style={{ zIndex: 1 }}
        aria-hidden="true"
        data-testid="constraint-badge"
      >
        <Target
          size={9}
          className={`text-info ${CANVAS_GLYPH_SIZE_CLASSES[9]}`}
          aria-hidden="true"
        />
      </div>
      {/* Transparent hover zone — carries tooltip and accessible label */}
      <div
        className={`absolute ${CANVAS_CORNER_OFFSET_CLASSES_LEFT[12]} ${CANVAS_GLYPH_SIZE_CLASSES[24]} rounded-full`}
        style={{ zIndex: 2 }}
        title={tooltip}
        aria-label={tooltip}
        data-testid="constraint-badge-hover"
      />
    </>
  )
})
