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

  /**
   * ⭐⭐ CORRECTED 22 Sep 2026 BY THE PRODUCER, and the old expectation was the
   * worst of both answers.
   *
   * This case used to assert `{ value: 0.8, unit: null }` — it painted the
   * meaningless constant AND stripped the unit. CEE measured the seam and
   * answered the ask directly: `goal_threshold_raw` + `goal_threshold_unit` are
   * declared in the `analysis_ready` schema and ship on **24 of 24**
   * goal-threshold-bearing nodes, and the schema's own comment instructs
   * exactly this rendering — *"Render the user's figure from
   * `goal_threshold_raw` + `goal_threshold_unit`."*
   *
   * So when an anchor exists there is no reason to show the normalised scale at
   * all: show the figure the person actually set, in the unit they set it in.
   * The "≥ 0.8 £" defect `GoalPanel` documents is avoided not by dropping the
   * unit but by dropping the NORMALISED MAGNITUDE — the number the unit never
   * described.
   */
  it('⭐ a normalised magnitude WITH an anchor shows the RAW figure and its unit', () => {
    const out = resolveDisplayableGoalTarget({
      goalThreshold: 0.8, representation: 'normalised', thresholdRaw: 20000, thresholdUnit: '£',
    })
    expect(out).toEqual({ value: 20000, unit: '£' })
  })

  /**
   * ⛔ THE 12 BOARDS. CEE found `goal_threshold` OUTSIDE [0,1] on 12 of 24 live
   * nodes — `1.1` where `raw/cap` is `110/140 = 0.7857` — all from the goal
   * *"Achieve NRR Above 110%"*. A percentage target above 100% normalised
   * against an implicit 0–100 scale. ⚠ CEE WITHDREW its first reading that this
   * is a live mint defect: the current resolver bounds the rule at `raw <= 100`
   * and could not have produced `cap = 140` with no provenance. It is residue
   * from one 70-minute window on 20 Sep, and it is UNTRIGGERED rather than
   * proven fixed — so the rows are still in the database today.
   *
   * ⭐ Showing the RAW is what rescues these boards: 110% is the user's real
   * goal and is worth stating, while the normalised 1.1 is incoherent. This
   * case is therefore a POSITIVE one, not a withholding — and it only works
   * because the rule above changed.
   */
  it('⛔ a normalised value outside [0,1] still yields the raw target, not the incoherent scalar', () => {
    const out = resolveDisplayableGoalTarget({
      goalThreshold: 1.1, representation: 'normalised', thresholdRaw: 110, thresholdUnit: '%',
    })
    expect(out, 'the reader deserves their own 110%').toEqual({ value: 110, unit: '%' })
  })

  /**
   * The anchor may arrive as a STRING — `hasRawAnchor` already accepts one, so
   * the value path must too or the module accepts an anchor it cannot return.
   */
  it('a string anchor is returned as a number', () => {
    const out = resolveDisplayableGoalTarget({
      goalThreshold: 0.8, representation: 'normalised', thresholdRaw: '20000', thresholdUnit: '£',
    })
    expect(out).toEqual({ value: 20000, unit: '£' })
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
