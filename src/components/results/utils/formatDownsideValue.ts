/**
 * ROADMAP 2.580 member 4 — "downside values were unitless even when the
 * user's goal was hours" (Codex simulated-user review, 5 Aug 2026).
 *
 * WHY A NEW HELPER RATHER THAN `formatThreshold`
 * ----------------------------------------------
 * `formatThreshold` (RangeVisualization.tsx) is the hero's unit-aware
 * formatter and was the obvious candidate — but its no-unit branch rounds
 * differently from `formatRangeValue` (`0.29` → `'0.3'`, not `'0.29'`). Using
 * it here would silently coarsen every unitless downside figure already on
 * screen, i.e. fix a units defect by shipping a precision regression.
 *
 * So the MAGNITUDE keeps going through `formatRangeValue` — byte-identical to
 * what the card printed before on every run that has no unit — and this helper
 * only decides what, if anything, may be written beside it.
 *
 * WHAT MAY BE WRITTEN BESIDE IT — THE BREADTH QUESTION (CLAUDE.md trap 22)
 * -----------------------------------------------------------------------
 * The unit is NOT carried by the analysis payload. `EnrichmentOutcomeStats`
 * (`@talchain/schemas@0.38.0`) declares `mean/std/p10/p50/p90/n_samples/…` and
 * no unit field, and the `downside` block is three bare numbers. The only unit
 * in play comes from the GOAL NODE (`observed_state.unit` →
 * `useResultsSectionData`'s `outcomeUnit`/`outcomeUnitSymbol`), and it is the
 * unit of the OUTCOME AXIS.
 *
 * That makes `isNormalised` load-bearing rather than incidental. When the run
 * has no `goal_threshold_cap`, the hook leaves the option magnitudes on PLoT's
 * normalised 0–1 scale (`useResultsSectionData`'s `scale = 1`,
 * `isNormalised = true`). Appending "hours" to a normalised score would not fix
 * the member — it would replace a missing claim with a FALSE one, on the same
 * screen, in the same sentence. So a normalised run gets no unit, exactly as
 * today, and the member's residual for that state is recorded on the row
 * rather than papered over here.
 *
 * The unit is appended in exactly one situation: the values are on the goal's
 * own scale AND someone stated what that scale measures.
 */

import type { OutcomeUnitType } from '../types'
import { formatRangeValue } from './formatRangeValue'

export interface DownsideUnitContext {
  /** Classified goal unit, from `useResultsSectionData`. */
  unit?: OutcomeUnitType
  /**
   * For `'currency'` this is the symbol (`'£'`); for `'count'` it is the RAW
   * unit string the user typed (`'hours'`), which is why a count unit can be
   * rendered at all. `'percent'` carries none — the `%` is the unit.
   */
  unitSymbol?: string
  /**
   * True when the magnitudes are PLoT's normalised 0–1 scores rather than user
   * units. A unit must NOT be attached in that state; see the header.
   */
  isNormalised?: boolean
}

/**
 * A downside magnitude, with its unit when — and only when — one applies.
 *
 * The number itself is always `formatRangeValue(value)`, unchanged.
 */
export function formatDownsideValue(value: number, ctx: DownsideUnitContext = {}): string {
  const magnitude = formatRangeValue(value)

  // Normalised scores are not in the goal's unit. Say the number and stop.
  if (ctx.isNormalised === true) return magnitude

  if (ctx.unit === 'currency' && ctx.unitSymbol) {
    // Negative tails read "-£1,200", not "£-1,200".
    return value < 0
      ? `-${ctx.unitSymbol}${formatRangeValue(Math.abs(value))}`
      : `${ctx.unitSymbol}${magnitude}`
  }

  if (ctx.unit === 'percent') return `${magnitude}%`

  if (ctx.unit === 'count' && ctx.unitSymbol) return `${magnitude} ${ctx.unitSymbol}`

  // No unit was ever stated for this goal — unchanged from before 2.580.
  return magnitude
}
