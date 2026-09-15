/**
 * ⭐⭐ A CLAMPED HEURISTIC IS NOT AN EXACT RATIO — and the clamp was inherited
 * from a lookup that no longer exists.
 *
 * ## Found by an independent post-merge review of #1585, executed
 *
 * `RangeDisplay` at `p10=.2, p50=.4, p90=.6` rendered *"The middle 80% of
 * outcomes span **40%** of the central value."* The true proportion is
 * **100%** — `span 0.4 / centre 0.4`. The equivalent `20/40/60` rendered 100%
 * correctly, **because there the clamp is inert**. Reviewer's words: *"Exposing
 * that heuristic as an exact ratio changes its meaning."*
 *
 * ⚠ AND IT IS MY OWN DEFECT CLASS, ONE STEP ALONG. #1585 replaced a BANDED
 * claim ("treat with extra caution") with a stated number — and carried the old
 * denominator across. `Math.max(Math.abs(center), 1)` guarded a band LOOKUP,
 * where a clamp only nudged which of four sentences was chosen and cost
 * nothing. Printing the quotient made it a published figure. **A value adequate
 * as an input to a band is not automatically adequate as a published number.**
 *
 * ## The second claim, and it is the quieter one
 *
 * `p10 === p90` was rendered *"Every outcome landed on the same value."* Those
 * are PERCENTILES: equal endpoints establish that the **middle 80%** collapsed.
 * The tails below p10 and above p90 may still differ — runs this function never
 * sees. The sentence now says exactly what the data establishes.
 *
 * ⚠ NO PRODUCTION CONSUMER. The reviewer found none, and neither do I; this is
 * a correction to a claim that would become false the moment the component is
 * mounted, not a served defect. It is fixed rather than registered because a
 * registration is a scheduler, and a scheduler that stops looks exactly like
 * one that found nothing.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RangeDisplay } from '../RangeDisplay'

const widthText = () => screen.getByTestId('range-display').textContent ?? ''

describe('the range states what the numbers support', () => {
  it('⭐ THE REPRODUCTION: 0.2 / 0.4 / 0.6 is 100%, not 40%', () => {
    render(<RangeDisplay p10={0.2} p50={0.4} p90={0.6} units="count" goalDirection="maximize" />)
    expect(widthText()).toContain('100%')
    // ⛔ The discriminating half. A component printing both figures, or one
    // that happened to contain "100" elsewhere, would pass a contains-only test.
    expect(widthText()).not.toContain('40% of the central value')
  })

  /**
   * ⛔ CONTRAST: the case where the clamp was INERT must be unchanged. If the
   * fix moved this one too, it would be a different formula rather than the
   * same formula honestly applied — and the reviewer's own control (20/40/60
   * already rendered 100%) is the evidence that mattered.
   */
  it('⛔ CONTRAST: 20 / 40 / 60 still renders 100% — the inert-clamp case did not move', () => {
    render(<RangeDisplay p10={20} p50={40} p90={60} units="count" goalDirection="maximize" />)
    expect(widthText()).toContain('100%')
  })

  it('⛔ CONTRAST: a genuinely narrow range still reads narrow', () => {
    // span 2 over a centre of 100 — 2%.
    render(<RangeDisplay p10={99} p50={100} p90={101} units="count" goalDirection="maximize" />)
    expect(widthText()).toContain('2%')
  })

  /**
   * ⛔ A PROPORTION OF ZERO HAS NO VALUE. `center === 0` is a BOUNDARY —
   * division is undefined there — not a threshold someone chose. The old code
   * fudged it to a denominator of 1 and printed a percentage anyway.
   */
  it('at a zero centre it states the SPAN, and invents no percentage', () => {
    render(<RangeDisplay p10={-5} p50={0} p90={5} units="count" goalDirection="maximize" />)
    expect(widthText()).toContain('span')
    expect(widthText()).not.toContain('of the central value')
  })

  it('⭐ equal percentiles claim the MIDDLE 80%, not every outcome', () => {
    render(<RangeDisplay p10={7} p50={7} p90={7} units="count" goalDirection="maximize" />)
    expect(widthText()).toContain('The middle 80% of outcomes all landed on the same value')
    // ⛔ The retired overclaim must be GONE, not merely outnumbered.
    expect(widthText()).not.toContain('Every outcome')
  })
})
