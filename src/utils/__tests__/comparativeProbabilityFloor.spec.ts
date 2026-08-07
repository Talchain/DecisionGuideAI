/**
 * ROADMAP 2.236 (P1-d) — ONE value, ONE instant, ONE floor.
 *
 * THE DEFECT, witnessed in a real browser on deployed staging `900dbd6c`
 * (`PHASE0-EVIDENCE-2026-07-28/walk-548-pixels.md`, finding F5). The sub-1%
 * display floor was applied on the CANVAS and not in the DOCK, so the same
 * option's same win probability rendered three different ways on one screen:
 *
 *   win_probability = 0.002675
 *     canvas option node       → "Came out ahead in < 1% of simulated scenarios"  ✅
 *     Analysis-tab option card → "Came out ahead in 0% of simulated scenarios"    ❌
 *     Olumi decision chip      → "Phased Hub-and-Spoke Pilot · 0%"                ❌
 *
 * The sharpest capture has CEE prose reading "each has less than a 1% chance"
 * directly ABOVE chips reading "1%" and "0%". Reachability was not forced —
 * staging produced these values unprompted in both walk scenarios.
 *
 * THE ROOT CAUSE was NOT the call sites. `formatProbabilityWithResolution` is
 * the shared comparative formatter, and its resolution arm is honest: with a
 * sample count it renders "<0.1%" style readouts. But its NO-SAMPLE-COUNT
 * FALLBACK arm was a bare `formatPercent(value, { fromDecimal: true })` with no
 * floor at all — and staging is not sending per-option `n_valid_samples`. So
 * every dock surface downstream of it (option cards, V7 lens rows, the analysis
 * hero) printed a bare "0%" while looking locally correct. One arm, three
 * surfaces: the fix belongs there and not at any of them.
 *
 * The values below are the LIVE ONES from the walk, not invented boundaries.
 */
import { describe, expect, it } from 'vitest'

import {
  SUB_ONE_PERCENT_FLOOR,
  SUB_ONE_PERCENT_READOUT,
  formatPercent,
  formatProbabilityWithResolution,
} from '../formatPercent'
import { formatWinProbability } from '../../canvas/utils/labelUtils'
import { formatGoalProbability } from '../../components/results/utils/displayFloors'

/** The three sub-1% win probabilities staging actually produced during the walk. */
const LIVE_SUB_ONE_PERCENT = [0.0001875, 0.002675, 0.005825]

describe('formatProbabilityWithResolution — the no-sample-count arm applies the shared floor (ROADMAP 2.236)', () => {
  it.each(LIVE_SUB_ONE_PERCENT)(
    'live staging value %s renders "< 1%%", never a bare "0%%" or "1%%"',
    (value) => {
      const rendered = formatProbabilityWithResolution(value, undefined)
      expect(rendered).toBe(SUB_ONE_PERCENT_READOUT)
      expect(rendered).not.toBe('0%')
      expect(rendered).not.toBe('1%')
    },
  )

  it('a null / zero / non-finite sample count takes the same floored arm', () => {
    for (const nSamples of [null, undefined, 0, -1, Number.NaN]) {
      expect(formatProbabilityWithResolution(0.002675, nSamples)).toBe(SUB_ONE_PERCENT_READOUT)
    }
  })

  it('an exact ZERO is a measurement, not a floor case — it still reads "0%"', () => {
    // "Came out ahead in 0% of simulated scenarios" is TRUE when the option
    // never came out ahead. The floor exists to stop a non-zero value being
    // printed as zero, not to stop zero being printed.
    expect(formatProbabilityWithResolution(0, undefined)).toBe('0%')
  })

  it('CONTROL — values at or above the floor are untouched', () => {
    expect(formatProbabilityWithResolution(SUB_ONE_PERCENT_FLOOR, undefined)).toBe('1%')
    expect(formatProbabilityWithResolution(0.73, undefined)).toBe('73%')
    expect(formatProbabilityWithResolution(0.995, undefined)).toBe('100%')
  })

  it('CONTROL — the RESOLUTION arm is unchanged: a real sample count still wins', () => {
    // With n=1000 the producer's own resolution is finer than the 1% floor and
    // must not be coarsened by it: 0.002675 is distinguishable at that sample
    // count, so it renders as a real number rather than "< 1%".
    const rendered = formatProbabilityWithResolution(0.002675, 1000)
    expect(rendered).not.toBe(SUB_ONE_PERCENT_READOUT)
    expect(rendered).not.toBe('0%')
  })

  it('POSITIVE CONTROL — the unfloored primitive still exists and still returns the bare string', () => {
    // Proves these assertions can SEE the defect: `formatPercent` is the
    // function the fallback arm used to return directly, and it is unchanged.
    expect(formatPercent(0.002675, { fromDecimal: true })).toBe('0%')
  })
})

describe('the sub-1% floor is ONE rule, shared by every register (ROADMAP 2.236)', () => {
  it.each(LIVE_SUB_ONE_PERCENT)(
    'canvas and dock agree on %s — the contradiction the walk photographed cannot recur',
    (value) => {
      // `formatWinProbability` is the canvas implementation that was already
      // correct; it now delegates rather than holding a second literal 0.01.
      expect(formatWinProbability(value)).toBe(SUB_ONE_PERCENT_READOUT)
      expect(formatProbabilityWithResolution(value, undefined)).toBe(formatWinProbability(value))
    },
  )

  it('the goal register uses the same floor CONSTANT (registers differ, the threshold does not)', () => {
    expect(formatGoalProbability(0.002675)).toBe(SUB_ONE_PERCENT_READOUT)
    expect(SUB_ONE_PERCENT_FLOOR).toBe(0.01)
  })

  it('the two registers legitimately differ at EXACT ZERO, and that difference is deliberate', () => {
    // Goal register: an option with a 0 goal probability is "< 1%" — the same
    // reading its option card has always shown (displayFloors documents the
    // deliberate absence of a `> 0` carve-out).
    expect(formatGoalProbability(0)).toBe(SUB_ONE_PERCENT_READOUT)
    // Comparative register: 0 means "never came out ahead", a real measurement.
    expect(formatWinProbability(0)).toBe('0%')
    expect(formatProbabilityWithResolution(0, undefined)).toBe('0%')
  })

  it('CONTROL — non-finite input is still the honest missing glyph on the canvas register', () => {
    expect(formatWinProbability(Number.NaN)).toBe('—')
  })
})
