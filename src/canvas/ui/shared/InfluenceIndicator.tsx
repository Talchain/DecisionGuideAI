/**
 * InfluenceIndicator — standardised edge strength display
 * ⛔ ORPHANED — NOT RENDERED ANYWHERE. Measured at this tip: **0 importers,
 * 0 JSX sites**, contrast controls in the same sweep `DataBar` 12 imports /
 * 61 JSX and `ConnectionRow` 11 / 15. The previous line here claimed it
 * "calls getStrengthLabel() across all canvas and inspector sites", which was
 * false and had been copied into four other files as a RENDERED claim.
 * The live equivalents are `StrengthBandButtons` (`EdgePanel.tsx:597,627`)
 * and `getStrengthLabel` in `inspector-v2/inspectorStrings.ts`.
 * Keep or delete it deliberately — but do not cite it as user-visible.
 *
 * ⚠ THE THRESHOLDS ARE NOT RESTATED HERE. This line used to spell them out
 * ("≥0.70 Very strong, ≥0.40 Strong, ≥0.20 Moderate, else Slight"), which is a
 * hand-maintained mirror of `CANVAS_STRENGTH_BANDS` (`domain/vocabulary.ts`) sitting
 * in a comment — the form of drift nothing can go red on. Read the table.
 *
 * Accepts either:
 *   - `strength` — signed value (-2 to 2); sign encodes direction
 *   - `weight` + `direction` — unsigned magnitude (0-2) + explicit direction string
 *
 * Variants:
 *   canvas    — compact inline text, colour inherited from parent
 *   inspector — full label + direction symbol, styled with panelMeta
 */

import { getStrengthLabel } from '../inspector-v2/inspectorStrings'
import { typography } from '../../../styles/typography'

type InfluenceIndicatorProps = {
  variant?: 'canvas' | 'inspector'
  className?: string
} & (
  | { strength: number; weight?: never; direction?: never }
  | { weight: number; direction: 'positive' | 'negative'; strength?: never }
)

export function InfluenceIndicator({
  strength,
  weight,
  direction,
  variant = 'inspector',
  className = '',
}: InfluenceIndicatorProps) {
  // Resolve magnitude and direction from either calling convention
  const magnitude = strength !== undefined ? Math.abs(strength) : (weight ?? 0)
  const isPositive = strength !== undefined ? strength >= 0 : direction !== 'negative'
  const dirWord = isPositive ? 'positive' : 'negative'
  const label = getStrengthLabel(magnitude)

  if (variant === 'canvas') {
    return (
      <span className={className}>
        {label} {dirWord}
      </span>
    )
  }

  // Inspector variant
  return (
    <span className={`${typography.panelMeta} ${className}`}>
      {label} {dirWord}
    </span>
  )
}
