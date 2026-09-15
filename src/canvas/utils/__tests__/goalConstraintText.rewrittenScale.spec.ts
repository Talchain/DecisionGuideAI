/**
 * ⭐⭐ A VALUE ALREADY REWRITTEN OUT OF THE READER'S SCALE PRINTS THE READER'S
 * WORDS, NOT THE MACHINE FORM.
 *
 * ## Witnessed, on the deployed build
 *
 * UI `79866c44`, CEE `0c0c503`, guest, fresh browser context, a FRESH draft
 * from a typed brief, read at the product's own terminal beat (72 s). Brief:
 * *"…while keeping monthly churn under 4%…"*.
 *
 * The factor card printed **`Limit ≤ 0.04 fraction`**.
 *
 * On the SAME row in the Model tab, all three of these were present:
 *
 *   Keep monthly churn at or below 4%   ≤ 0.04 fraction   You said: "while keeping monthly churn under 4%"
 *
 * — the producer's label (correct), the reconstruction (machine form), and the
 * quote (correct). ⛔ **The card showed only the middle one**, because
 * `omitLabel` drops the label — the card's title already names the factor — and
 * the reconstruction path then formats `0.04` with the unit it was given.
 *
 * ## ⛔ What this change is NOT
 *
 * It does not multiply by 100. Turning `0.04` into `4%` would be this surface
 * deciding what scale a number is in, which is the mechanism behind the 100×
 * defect found the same morning (`1.1` rendered as `1.1%` against a brief
 * saying 110%). The ruling is that the UI's words may be SELECTED BY A PRODUCER
 * FIELD, never COMPUTED FROM THE NUMBERS. Selecting the reader's own sentence
 * is selection; rescaling the value is computation.
 *
 * ## Why the twins matter more than the binding case
 *
 * An over-wide version of this preference has already shipped and been caught:
 * a CURRENCY limit reconstructs exactly (`49` + `£` = `£49`, the reader's own
 * figure), so preferring the quote there replaces a precise rendering with a
 * looser one for no gain. Every test below has its opposite-direction twin.
 */
import { describe, it, expect } from 'vitest'
import { goalConstraintText, goalConstraintTextUsesQuote } from '../goalConstraintText'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const CHURN_QUOTE = 'while keeping monthly churn under 4%'

function constraint(over: Partial<CEEGoalConstraint> = {}): CEEGoalConstraint {
  return {
    node_id: 'fac_churn',
    label: 'Keep monthly churn at or below 4%',
    operator: 'lte',
    value: 0.04,
    unit: 'fraction',
    source_quote: CHURN_QUOTE,
    ...over,
  } as CEEGoalConstraint
}

describe('a rewritten scale prints the reader’s words', () => {
  it('⭐ the measured case: a fraction-unit limit no longer prints “0.04 fraction” on the card', () => {
    const text = goalConstraintText(constraint(), [], { omitLabel: true })
    expect(text).toContain(CHURN_QUOTE)
    // ⛔ The discriminating half. A surface printing BOTH would satisfy the
    // assertion above while still showing the machine form to the reader.
    expect(text).not.toContain('0.04')
    expect(text).not.toContain('fraction')
  })

  it('the sibling units a producer uses for the same rewrite are covered', () => {
    for (const unit of ['fraction', 'ratio', 'proportion', 'unit_interval', 'FRACTION', ' Ratio ']) {
      expect(goalConstraintTextUsesQuote(constraint({ unit })), unit).toBe(true)
    }
  })

  /**
   * ⛔ THE TWIN THAT HAS ALREADY CAUGHT A REAL OVER-REACH. `49` with unit `£`
   * reconstructs to `£49` — the reader's own figure, exactly. Preferring the
   * quote there trades a precise rendering for a looser one.
   */
  it('⛔ CONTRAST: a CURRENCY limit still reconstructs, and does not take the quote', () => {
    const c = constraint({ unit: '£', value: 49, source_quote: 'under £49 a seat' })
    expect(goalConstraintTextUsesQuote(c)).toBe(false)
    expect(goalConstraintText(c, [], { omitLabel: true })).toContain('£49')
  })

  it('⛔ CONTRAST: a plain count still reconstructs', () => {
    const c = constraint({ unit: 'count', value: 12, source_quote: 'no more than 12 people' })
    expect(goalConstraintTextUsesQuote(c)).toBe(false)
    expect(goalConstraintText(c, [], { omitLabel: true })).toContain('12')
  })

  /**
   * ⚠ NO QUOTE, NO SUBSTITUTION. Without the reader's sentence there is nothing
   * better to show, and inventing one is the defect this whole ladder exists to
   * prevent. The machine form is then the honest rendering, however ugly.
   */
  it('⛔ CONTRAST: with no source_quote it falls back rather than inventing one', () => {
    const c = constraint({ source_quote: undefined })
    expect(goalConstraintTextUsesQuote(c)).toBe(false)
    expect(goalConstraintText(c, [], { omitLabel: true })).toContain('0.04')
  })

  it('⛔ CONTRAST: a percent unit was ALREADY on this path and still is', () => {
    expect(goalConstraintTextUsesQuote(constraint({ unit: '%', value: 4 }))).toBe(true)
  })

  /**
   * ⭐ THE RULING, PINNED DIRECTLY: the value is never rescaled. A fraction of
   * 0.04 must not become the string "4%" anywhere on this path — that would be
   * the UI inferring scale from magnitude, which is how `1.1` became `1.1%`
   * against a brief saying 110%.
   */
  it('⛔ it never converts the scale — 0.04 does not become “4%”', () => {
    const withoutQuote = goalConstraintText(constraint({ source_quote: undefined }), [], { omitLabel: true })
    expect(withoutQuote).not.toContain('4%')
    expect(withoutQuote).toContain('0.04')
  })
})
