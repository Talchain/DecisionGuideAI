/**
 * ⭐ THE COUNT IS A CLAIM ABOUT THE USER'S MODEL, SO IT MUST ASK ABOUT VALUES.
 *
 * The review on #1291 found `noValueTotal` derived from `valueText === null`.
 * That field answers "is there text to render", not "does a value exist" —
 * `factorDisplayText` deliberately returns `null` for factors that DO carry a
 * value (`formatFactorDisplayValue.ts:401` and `:412`). The strip therefore
 * offered a worklist of factors to fill in that were already filled in.
 *
 * ⚠ THE FIXTURES BELOW ARE THE PRODUCER'S SHAPE, NOT MINE. Each is a case
 * `factorDisplayText` is documented to suppress; the precondition test asserts
 * that suppression rather than assuming it, so if the formatter ever starts
 * rendering these the tests fail loudly instead of quietly testing nothing.
 */

import { describe, it, expect } from 'vitest'
import { buildModelStrip, factorCarriesValue } from '../buildModelStrip'
import { factorDisplayText } from '../../../../utils/formatFactorDisplayValue'

/**
 * ⚠ `observedState`, CAMEL CASE — and this cost me a false pass. My first
 * fixtures used `observed_state`, which `factorCarriesValue` reads but
 * `factorDisplayText` does NOT (`formatFactorDisplayValue.ts:193` reads
 * `data.observedState` only). So the formatter returned `null` because it could
 * not see the data at all, and the discriminating test below passed for a reason
 * that had nothing to do with the defect. The contrast control caught it.
 */
const factor = (id: string, observed: Record<string, unknown>) => ({
  id,
  type: 'factor',
  position: { x: 0, y: 0 },
  data: { label: `Factor ${id}`, kind: 'factor', observedState: observed },
})

/** A value the formatter renders — the contrast case. */
const RENDERED = { value: 0, factor_type: 'cost', raw_value: 0, unit: '£' }
/** Non-binary numeric, no usable unit → suppressed at :412, but a value EXISTS. */
const SUPPRESSED_NUMERIC = { value: 0.42, unit: 'index' }
/** Genuinely nothing stated. */
const EMPTY = { source: 'cee' }

describe('noValueTotal counts values, not display text', () => {
  it('PRECONDITION: the formatter really does suppress a factor that HAS a value', () => {
    // If this stops holding, the discriminating test below is vacuous.
    expect(factorDisplayText(factor('a', SUPPRESSED_NUMERIC).data)).toBeNull()
    // CONTRAST: and it really does render the other one, so suppression is not
    // simply "this formatter returns null for everything I hand it".
    expect(factorDisplayText(factor('b', RENDERED).data)).not.toBeNull()
  })

  it('PRECONDITION: the predicate sees a value the formatter refuses to print', () => {
    expect(factorCarriesValue(factor('a', SUPPRESSED_NUMERIC))).toBe(true)
    expect(factorCarriesValue(factor('c', EMPTY))).toBe(false)
  })

  /**
   * ⭐ THE DISCRIMINATING CASE. Under the old derivation this strip reported 2;
   * only ONE of these factors actually lacks a value.
   */
  it('a factor whose text is suppressed is NOT counted as having no value', () => {
    const strip = buildModelStrip([
      factor('has-value-no-text', SUPPRESSED_NUMERIC),
      factor('genuinely-empty', EMPTY),
    ] as never)
    expect(strip.noValueTotal).toBe(1)
  })

  it('a factor with a rendered value is not counted either', () => {
    const strip = buildModelStrip([factor('rendered', RENDERED)] as never)
    expect(strip.noValueTotal).toBe(0)
  })

  it('display_value alone is a stated value — the producer said something', () => {
    const strip = buildModelStrip([
      factor('ctx', { display_value: 'No acquisition pursued' }),
    ] as never)
    expect(strip.noValueTotal).toBe(0)
  })

  it('an empty string is not a value', () => {
    expect(factorCarriesValue(factor('blank', { raw_value: '   ' }))).toBe(false)
  })

  /**
   * ⭐⭐ THE REVIEWER'S CONCRETE, REACHABLE FAILURE — pinned as they described it.
   *
   * "A reader presses '5 with no value yet', the strip narrows to those factors,
   * and they set a value on one on the MODEL SCALE."
   * `factorValueEdit.ts:304-307` attaches `raw_value`/`unit` ONLY `if
   * (inUserUnits)`, so a model-scale edit persists `{value: 0.7, source:
   * 'user_override'}` with no raw_value and no unit. Under the old derivation
   * `factorDisplayText` returned null for that shape, so the strip STILL counted
   * the factor and still rang it: **the worklist did not clear as the user
   * worked it**, while the Model tab four inches away said "you set 1".
   */
  it('a value the USER set on the model scale clears the worklist', () => {
    const strip = buildModelStrip([
      factor('user-set', { value: 0.7, source: 'user_override' }),
    ] as never)
    expect(strip.noValueTotal).toBe(0)
    // PRECONDITION: this really is the suppressed shape — no raw_value, no unit —
    // so the assertion above is about the fix and not about a factor that always
    // rendered fine.
    expect(factorDisplayText(factor('user-set', { value: 0.7, source: 'user_override' }).data))
      .toBeNull()
  })

  it('a unit does not save a factor whose raw_value is absent', () => {
    // The reviewer's second shape: `{value: 26000, unit: '£', raw_value: null}`
    // still returns null from the formatter (Pattern 1 needs raw_value), but the
    // value is plainly stated.
    const observed = { value: 26000, unit: '£' }
    expect(factorDisplayText(factor('u', observed).data)).toBeNull()
    expect(buildModelStrip([factor('u', observed)] as never).noValueTotal).toBe(0)
  })

  /**
   * ⚠ SCOPE CONTROL. Non-factors carry no `observed_state` in this shape, so an
   * unscoped count would return the whole model — the failure the original
   * `r.kind === 'factor'` guard was written for. It must survive this change.
   */
  it('non-factors are never counted, however many there are', () => {
    const option = (id: string) => ({
      id, type: 'option', position: { x: 0, y: 0 }, data: { label: id, kind: 'option' },
    })
    const strip = buildModelStrip([
      option('o1'), option('o2'), option('o3'),
      factor('genuinely-empty', EMPTY),
    ] as never)
    expect(strip.noValueTotal).toBe(1)
  })
})
