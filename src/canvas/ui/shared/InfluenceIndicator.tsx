/**
 * InfluenceIndicator — standardised edge strength display
 * Uses getStrengthLabel() thresholds (≥0.70 Very strong, ≥0.40 Strong, ≥0.20 Moderate, else Slight)
 * across all canvas and inspector sites — supersedes describeEdgeInfluence() old thresholds.
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
  const dirSymbol = isPositive ? '+' : '\u2212'
  const label = getStrengthLabel(magnitude)

  if (variant === 'canvas') {
    return (
      <span className={className}>
        {label} {dirSymbol}
      </span>
    )
  }

  // Inspector variant
  return (
    <span className={`${typography.panelMeta} ${className}`}>
      {label} {dirSymbol}
    </span>
  )
}
