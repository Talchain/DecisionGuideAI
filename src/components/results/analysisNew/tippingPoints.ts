/**
 * ⭐ THE TIPPING POINT: live producer data the Reasoning tab used only to say
 * NOTHING flips.
 *
 * `flip_thresholds[]` reaches `data.recommendation.flipThresholds` already
 * normalised (`useResultsSectionData.ts:2548`). On this surface its only reader
 * is `attestsNoFactorFlip` — the NEGATIVE attestation. So a row that actually
 * FOUND a threshold rendered nowhere.
 *
 * Measured on Paul's run `1dd2133d` (16 Sep):
 *
 *   { factor_label: 'Tech Lead Presence', current_value: 0.6,
 *     flip_value: 0.9619, alternative_winner_label: 'Two Developers',
 *     flip_reason: 'found' }
 *
 * That is the most concrete decision-relevant sentence the run produced, and
 * the tab was silent about it.
 *
 * ⛔ NOTHING IS COMPUTED HERE. Every field is the producer's. There is no
 * arithmetic, no inference of direction from a sign, and no row admitted that
 * the producer did not mark `found` with both endpoints and a named
 * alternative. Fail-closed: a partial row is dropped, never completed.
 *
 * ⚠ WHY `flip_reason === 'found'` AND NOT `flip_value !== null`. They are
 * different questions and the producer answers the first one. `no_effect_within_bounds`
 * and `structurally_invariant` rows also carry a null `flip_value`, and reading
 * the value alone would silently treat "we looked and there is none" the same
 * as "we could not look" (CLAUDE.md trap 21 / the withheld-vs-absent class this
 * panel has already been bitten by twice).
 */

/** The producer's row, as `useResultsSectionData` normalises it. */
export type FlipThresholdLike = {
  label?: unknown
  current_value?: unknown
  flip_value?: unknown
  flip_reason?: unknown
  unit?: unknown
  alternative_winner_label?: unknown
}

export type TippingPoint = {
  /** The factor, by the producer's label. */
  factorLabel: string
  /** Where the factor sits now. */
  currentValue: number
  /** Where it would have to reach. */
  flipValue: number
  /** The option the producer says would come out ahead there. */
  alternativeLabel: string
  /** The producer's unit, or `''`. Never invented. */
  unit: string
}

const finite = (v: unknown): number | null =>
  typeof v === 'number' && Number.isFinite(v) ? v : null

const nonEmpty = (v: unknown): string | null =>
  typeof v === 'string' && v.trim().length > 0 ? v.trim() : null

/**
 * The rows the producer says it FOUND a threshold for, complete enough to state.
 *
 * A row survives only when the producer marked it `found` AND supplied a
 * baseline, a flip value and the alternative's name. Anything less is dropped:
 * without a baseline there is no "from", and without a named alternative the
 * sentence would have to invent what changes.
 */
export function buildTippingPoints(
  rows: ReadonlyArray<FlipThresholdLike> | null | undefined,
): TippingPoint[] {
  if (!Array.isArray(rows)) return []
  const out: TippingPoint[] = []
  for (const row of rows) {
    if (row === null || typeof row !== 'object') continue
    if (row.flip_reason !== 'found') continue
    const factorLabel = nonEmpty(row.label)
    const alternativeLabel = nonEmpty(row.alternative_winner_label)
    const currentValue = finite(row.current_value)
    const flipValue = finite(row.flip_value)
    if (factorLabel === null || alternativeLabel === null) continue
    if (currentValue === null || flipValue === null) continue
    // A threshold at the value the factor already sits at states no change and
    // would read as a claim that the answer is already flipping.
    if (currentValue === flipValue) continue
    out.push({
      factorLabel,
      currentValue,
      flipValue,
      alternativeLabel,
      unit: nonEmpty(row.unit) ?? '',
    })
  }
  return out
}
