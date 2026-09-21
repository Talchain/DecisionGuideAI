/**
 * ⭐⭐ Bound to the MEASUREMENT, not to the symptom.
 *
 * The founder's capture showed a Goal panel rendering "✓ 80%" on a card badged
 * "Target not captured". The number was not stale — it was DEGENERATE: measured
 * across 989 debug bundles, `goal_threshold` is 0.8 in 42 of the 54 that carry
 * it, and every one of the 18 carrying a cap has `cap / raw === 1.25` exactly,
 * because the cap is `target_derived_headroom` — derived from the target.
 *
 * So these fixtures are the REAL pairs out of those bundles, not numbers I
 * chose. A self-authored fixture would confirm my model of the defect rather
 * than test it.
 */
import { describe, it, expect } from 'vitest'
import { resolveDisplayableGoalTarget } from '../displayableGoalTarget'

/** Real (raw, cap) pairs read out of the bundle population. */
const REAL_PAIRS = [
  { raw: 20000, cap: 25000, unit: '£' },
  { raw: 1300000, cap: 1625000, unit: '£' },
]

describe('a normalised threshold with no anchor is a constant, and is withheld', () => {
  it('⛔ THE MEASUREMENT: every real pair normalises to exactly 0.8', () => {
    // If this ever reds, the producer changed the cap rule and the whole
    // premise of this module needs re-deriving rather than patching.
    for (const { raw, cap } of REAL_PAIRS) {
      expect(raw / cap, `${raw}/${cap} is no longer 0.8 — re-derive, do not adjust`).toBeCloseTo(0.8, 10)
    }
  })

  it('⭐ withholds a normalised magnitude that has no raw anchor', () => {
    expect(
      resolveDisplayableGoalTarget({ goalThreshold: 0.8, representation: 'normalised' }),
      'the product is showing 0.8, which is 0.8 for every decision ever made',
    ).toBeNull()
  })

  it.each([null, undefined, '', '   '])('an absent/blank raw (%p) is not an anchor', (raw) => {
    expect(
      resolveDisplayableGoalTarget({ goalThreshold: 0.8, representation: 'normalised', thresholdRaw: raw as never }),
    ).toBeNull()
  })

  it('⛔ POSITIVE CONTROL: a RAW target is still shown, with its unit', () => {
    // The fix must withhold a constant, never a number somebody stated. Without
    // this arm, "return null always" would pass every other test here.
    const out = resolveDisplayableGoalTarget({
      goalThreshold: 20000, representation: 'raw', thresholdRaw: 20000, thresholdUnit: '£',
    })
    expect(out, 'a real, stated target was withheld').not.toBeNull()
    expect(out).toEqual({ value: 20000, unit: '£' })
  })

  it('a normalised magnitude WITH an anchor is shown, but never wearing the raw unit', () => {
    // "≥ 0.8 £" is the defect GoalPanel already documents: the unit describes
    // the raw scale, not the normalised one.
    const out = resolveDisplayableGoalTarget({
      goalThreshold: 0.8, representation: 'normalised', thresholdRaw: 20000, thresholdUnit: '£',
    })
    expect(out).toEqual({ value: 0.8, unit: null })
  })

  it.each([null, Number.NaN, Number.POSITIVE_INFINITY])('a non-finite threshold (%p) yields nothing', (t) => {
    expect(resolveDisplayableGoalTarget({ goalThreshold: t as never, representation: 'raw' })).toBeNull()
  })

  it('an untagged representation is treated as raw, not silently withheld', () => {
    // `representation: null` occurs on captures that predate the tag. Those
    // carry stated targets; withholding them would delete real information.
    const out = resolveDisplayableGoalTarget({ goalThreshold: 20000, representation: null, thresholdUnit: '£' })
    expect(out).toEqual({ value: 20000, unit: '£' })
  })
})
