/**
 * `formatGoalProbability` — THE GOAL REGISTER GETS A RESOLUTION ARM
 * (ROADMAP 2.333 / 2.334, PC2 + PC4).
 *
 * ─────────────────────────────────────────────────────────────────────────
 * WHY THIS FILE EXISTS
 * ─────────────────────────────────────────────────────────────────────────
 * The GOAL register's formatter was floor-only: every value below 1% became
 * the single string "< 1%". On the walk's run that collapsed FIVE distinct
 * measured probabilities — 0.0007, 0.0001, 0.0004, 0, 0.0002 — into five
 * identical readouts, so the Model tab's goal rows rendered an ordering the
 * user could not see (PC4). The COMPARATIVE register had solved this a
 * release earlier: `formatProbabilityWithResolution` already derives its
 * precision from `n_valid_samples`, which IS on the wire
 * (`option_probabilities[id].outcome.n_valid_samples`, 10000 on the walk).
 *
 * The fix delegates rather than re-implementing: with a positive finite
 * sample count, the goal formatter calls the comparative primitive's
 * sample-count arm. Two registers, ONE resolution rule — a second
 * hand-rolled precision ladder is exactly the divergence UI-SEM-057 exists
 * to abolish.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * ⚠ EVERY EXPECTED STRING IN THIS FILE WAS DERIVED BY EXECUTION, NOT BY
 *   READING THE DESIGN
 * ─────────────────────────────────────────────────────────────────────────
 * The design pack for this slice asserted 0.0007 → "0.07%" in its first
 * draft and REFUTED ITSELF on execution: the smallest-distinct-precision
 * rule renders "0.1%", because precision 1 already renders non-zero and
 * rounding COARSER than the resolution never overclaims. The values below
 * were read off a run of the real formatter at this tip. Do not "correct"
 * them from first principles — re-execute instead.
 *
 * THE HONESTY CONSTRAINT, stated so a later reader can check it:
 * printed digits are supported iff the rendering never distinguishes values
 * finer than 1/n. At n=10000 the resolution is 0.01 percentage points, and
 * every string below is at or coarser than that. Fixed "two significant
 * figures" is rejected — it would print "0.070%", a digit the wire cannot
 * carry.
 *
 * NOTE THE TWO DISTINCT SUB-1% STRINGS — they are not interchangeable:
 *   · "< 1%"  (WITH a space) — the register FLOOR readout, no resolution info
 *   · "<1%"   (NO space)     — the THRESHOLD form, derived from a real n
 */

import { describe, it, expect } from 'vitest'
import { formatGoalProbability, SUB_ONE_PERCENT_READOUT } from '../displayFloors'
import { formatProbabilityWithResolution } from '../../../../utils/formatPercent'

/** The walk's measured `probability_of_goal` quintet, in producer order. */
const WALK_QUINTET = [0.0007, 0.0001, 0.0004, 0, 0.0002] as const
const WALK_N = 10000

describe('formatGoalProbability — positive control (trap 13)', () => {
  it('renders a non-degenerate value identically with and without a sample count', () => {
    // An absence assertion must first prove it can see a presence. If the
    // formatter stopped resolving at all, every "distinct strings" claim
    // below would pass by testing nothing.
    expect(formatGoalProbability(0.34)).toBe('34%')
    expect(formatGoalProbability(0.34, WALK_N)).toBe('34%')
  })
})

describe('T-2333-1 — the sample-count arm delegates to the comparative primitive', () => {
  it('resolves the walk quintet to five DISTINCT strings at n=10000', () => {
    const rendered = WALK_QUINTET.map((v) => formatGoalProbability(v, WALK_N))
    // Executed values — see the header. Producer order.
    expect(rendered).toEqual(['0.1%', '0.01%', '0.04%', '<0.01%', '0.02%'])
    expect(new Set(rendered).size).toBe(WALK_QUINTET.length)
  })

  it('is byte-identical to `formatProbabilityWithResolution` on the sample-count arm', () => {
    // Bound to the SHARED primitive by identity, not to a copied ladder: a
    // second precision implementation inside the goal register would satisfy
    // the string assertions above and still be the defect this slice removes.
    for (const v of [...WALK_QUINTET, 0.55, 0.002675, 0.9999]) {
      expect(formatGoalProbability(v, WALK_N)).toBe(formatProbabilityWithResolution(v, WALK_N))
    }
  })

  it('renders an exact wire zero as the resolution threshold, never "0%"', () => {
    // A true zero with samples is "fewer than one hit in n runs" — a bound,
    // not a measurement of zero. "0%" would claim the latter.
    expect(formatGoalProbability(0, WALK_N)).toBe('<0.01%')
    expect(formatGoalProbability(0, WALK_N)).not.toBe('0%')
  })

  it('renders mid-range values unchanged when a sample count is present', () => {
    expect(formatGoalProbability(0.55, WALK_N)).toBe('55%')
  })
})

describe('T-2334-2 — precision derives from n, never from a constant', () => {
  it('renders 0.0007 at n=10000 as EXACTLY "0.1%"', () => {
    const rendered = formatGoalProbability(0.0007, 10000)
    expect(rendered).toBe('0.1%')
    // The two overclaiming renderings this rule exists to refuse. "0.07%"
    // was the design's own first (wrong) answer; "0.070%" is what a fixed
    // two-significant-figures rule would print — a trailing digit at, and
    // then beyond, the wire's resolution.
    expect(rendered).not.toBe('0.07%')
    expect(rendered).not.toBe('0.070%')
  })

  it('renders the SAME value differently at a different n — the bound moves with the wire', () => {
    // At n=100 the resolution is 1 percentage point, so 0.0007 is below the
    // threshold and renders in THRESHOLD form (no space) — not the register
    // floor "< 1%" (with space), which is what an n-blind formatter gives.
    expect(formatGoalProbability(0.0007, 100)).toBe('<1%')
    expect(formatGoalProbability(0.0007, 10000)).toBe('0.1%')
    expect(formatGoalProbability(0.0007, 100)).not.toBe(formatGoalProbability(0.0007, 10000))
  })

  it('never prints finer than the wire resolution at n=10000', () => {
    // 1/10000 = 0.01 percentage points. Every rendered decimal string must
    // survive a round-trip at that granularity: no digit may encode a
    // distinction the sampler could not have made.
    for (const v of WALK_QUINTET) {
      const rendered = formatGoalProbability(v, WALK_N)
      const numeric = Number(rendered.replace(/[<>%]/g, ''))
      expect(Number.isFinite(numeric)).toBe(true)
      // value-in-percentage-points is an exact multiple of 100/n = 0.01
      expect(Math.abs(Math.round(numeric * 100) - numeric * 100)).toBeLessThan(1e-9)
    }
  })
})

describe('T-2334-3 — the no-resolution fallback is BYTE-IDENTICAL to today', () => {
  // The regression pin for every surface the wire does not reach. This arm
  // must not acquire the comparative register's exact-zero behaviour: the
  // goal register deliberately floors an exact zero to "< 1%" so a canvas
  // node and the card beside it cannot disagree, and that decision is older
  // than this slice.
  it('floors sub-1% values to the shared readout when nSamples is absent', () => {
    for (const v of [0.0007, 0.0001, 0.0004, 0.0002, 0.002675, 0.009999]) {
      expect(formatGoalProbability(v)).toBe(SUB_ONE_PERCENT_READOUT)
      expect(formatGoalProbability(v, undefined)).toBe(SUB_ONE_PERCENT_READOUT)
      expect(formatGoalProbability(v, null)).toBe(SUB_ONE_PERCENT_READOUT)
    }
  })

  it('floors an EXACT ZERO to the register readout, NOT to the comparative "0%"', () => {
    expect(formatGoalProbability(0)).toBe('< 1%')
    expect(formatGoalProbability(0, undefined)).toBe('< 1%')
    // The deliberate divergence from the comparative register, pinned so a
    // future "just delegate everything" simplification cannot erase it.
    expect(formatProbabilityWithResolution(0, undefined)).toBe('0%')
    expect(formatGoalProbability(0)).not.toBe(formatProbabilityWithResolution(0, undefined))
  })

  it('renders at-or-above-1% values through the legacy percent path unchanged', () => {
    expect(formatGoalProbability(0.55)).toBe('55%')
    expect(formatGoalProbability(0.01)).toBe('1%')
    expect(formatGoalProbability(0.995)).toBe('100%')
  })

  it('treats a non-positive or non-finite sample count as NO resolution info', () => {
    for (const n of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(formatGoalProbability(0.0007, n)).toBe(SUB_ONE_PERCENT_READOUT)
    }
  })
})
