/**
 * Outcome-view lens pick — BEHAVIOUR CHANGE 3 of 3 (§6.5 item 5, Paul's
 * consistency ruling: the behaviour change is ACCEPTED).
 *
 * Before: the control offered three arms — cautious (p10), NEUTRAL, bold
 * (p90) — and the middle arm featured whichever option led on the
 * COMPARATIVE quantity. Two arms ranked the outcome distribution, one ranked
 * something else, under one control. A user stepping through the arms was
 * comparing three quantities and told they were comparing one.
 *
 * After: all three arms rank the outcome distribution — p10 / p50 / p90.
 *
 * ⚠ HONEST SCOPE OF THIS PIN. It pins the DERIVATION. The middle arm is
 * still the default, un-overlaid view (`lensActive` is false there, exactly
 * as before), so the featured id it produces is not painted today; making
 * the middle arm overlay like the other two would flip the `decisionState` /
 * `hinge` gating that keys off the same value, which is a separate change
 * with a much wider blast radius. Stated here rather than left for a reader
 * to discover: this test proves the quantity moved, not that a pixel did.
 *
 * RED-first: the middle-arm assertions fail on `bf86f672`.
 */

import { describe, expect, it } from 'vitest'
import { selectLensOption, lensMetric, type LensOption } from '../selectLensOption'

/**
 * A fixture where the three quantities DISAGREE — the only kind that can
 * tell the arms apart.
 *
 *            p10    p50    p90   comparative
 *   cautious  90     10     20      0.10
 *   middle    10     90     20      0.10
 *   bold      10     10     90      0.90   ← the old middle-arm answer
 */
const OPTIONS: LensOption[] = [
  { id: 'cautious', outcome: { p10: 90, p50: 10, p90: 20 } },
  { id: 'middle', outcome: { p10: 10, p50: 90, p90: 20 } },
  { id: 'bold', outcome: { p10: 10, p50: 10, p90: 90 } },
]

/** The comparative leader, i.e. what the middle arm used to feature. */
const COMPARATIVE_LEADER_ID = 'bold'

describe('selectLensOption — every arm ranks the outcome distribution', () => {
  it('cautious features the highest p10', () => {
    expect(selectLensOption(OPTIONS, 'cautious')).toEqual({ id: 'cautious', comparable: true })
  })

  it('MIDDLE features the highest p50 — not the comparative leader', () => {
    const picked = selectLensOption(OPTIONS, 'middle')
    expect(picked).toEqual({ id: 'middle', comparable: true })
    expect(picked.id).not.toBe(COMPARATIVE_LEADER_ID)
  })

  it('optimistic features the highest p90', () => {
    expect(selectLensOption(OPTIONS, 'optimistic')).toEqual({ id: 'bold', comparable: true })
  })

  it('reads one quantity family for every arm — p10, p50, p90 and nothing else', () => {
    const o = OPTIONS[1]
    expect(lensMetric(o, 'cautious')).toBe(10)
    expect(lensMetric(o, 'middle')).toBe(90)
    expect(lensMetric(o, 'optimistic')).toBe(20)
  })
})

describe('selectLensOption — a comparison needs data', () => {
  it('reports not-comparable rather than crowning an option with no p50', () => {
    const sparse: LensOption[] = [
      { id: 'a', outcome: { p10: 1, p50: 5, p90: 9 } },
      { id: 'b', outcome: { p10: 1, p50: null, p90: 9 } },
    ]
    expect(selectLensOption(sparse, 'middle')).toEqual({ id: undefined, comparable: false })
  })

  it('never defaults a missing metric to zero (which would let a data-less option place)', () => {
    const sparse: LensOption[] = [
      { id: 'a', outcome: { p10: null, p50: null, p90: null } },
      { id: 'b', outcome: { p10: -5, p50: -5, p90: -5 } },
      { id: 'c', outcome: { p10: -9, p50: -9, p90: -9 } },
    ]
    // Both comparable rows are NEGATIVE. A zero default would put 'a' first.
    expect(selectLensOption(sparse, 'middle')).toEqual({ id: 'b', comparable: true })
  })

  it('is not comparable with fewer than two options', () => {
    expect(selectLensOption([OPTIONS[0]], 'middle')).toEqual({ id: undefined, comparable: false })
    expect(selectLensOption([], 'cautious')).toEqual({ id: undefined, comparable: false })
  })

  it('falls back to the deprecated flat fields when outcome is absent', () => {
    const flat: LensOption[] = [
      { id: 'a', p10: 1, p50: 9, p90: 1 },
      { id: 'b', p10: 9, p50: 1, p90: 9 },
    ]
    expect(selectLensOption(flat, 'middle')).toEqual({ id: 'a', comparable: true })
  })
})
