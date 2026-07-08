// Pure edge visual encoding for the vNext decision map (UI-SEM-075).
//
// Channels (no channel duplicates another):
//   arrowhead  = direction (drawn by VNextEdge, stroke-coloured)
//   colour     = helps/hurts polarity (design tokens, never Goal's yellow)
//   thickness  = strength, in FOUR discrete bands aligned to the unified
//                vocab ladder (Slight/Moderate/Strong/Very strong at
//                0.20/0.40/0.70) so the picture matches the words —
//                deliberately NOT the continuous weightToStrokeWidth
//   dash       = existence certainty, reusing the live binary rule verbatim
//                (existenceCertaintyToLineStyle: solid ≥ 0.7, dashed below —
//                the three-tier solid/dashed/dotted scheme in StyledEdge's
//                comments is stale and was never implemented)
//   opacity    = NOT encoded here (dimming owns it)

import type { EdgePolarity } from '../vm/types'

/** Strength-band widths in px, boundaries shared with getStrengthLabel. */
export function strengthBandWidth(absStrength: number): number {
  if (absStrength >= 0.7) return 4 // Very strong
  if (absStrength >= 0.4) return 3 // Strong
  if (absStrength >= 0.2) return 2 // Moderate
  return 1.5 // Slight
}

export function polarityFromSignedMean(signedMean: number | null | undefined): EdgePolarity {
  if (typeof signedMean !== 'number' || Number.isNaN(signedMean) || signedMean === 0) return 'unknown'
  return signedMean > 0 ? 'helps' : 'hurts'
}

/** Stroke/arrowhead colour per polarity — token vars only. */
export function polarityColor(polarity: EdgePolarity): string {
  switch (polarity) {
    case 'helps':
      return 'var(--success)'
    case 'hurts':
      return 'var(--danger)'
    default:
      return 'var(--text-light)'
  }
}

/**
 * Dash pattern from existence certainty (beliefExists). Same threshold and
 * pattern as the live existenceCertaintyToLineStyle helper
 * (src/canvas/utils/graphDisplayCalculations.ts): solid at ≥0.7 or unknown,
 * dashed '6,4' below.
 */
export function existenceDashArray(beliefExists: number | null | undefined): string | undefined {
  if (typeof beliefExists !== 'number' || beliefExists >= 0.7) return undefined
  return '6,4'
}
