/**
 * `determinedRankDepth` — the widened tie gate, and its equivalence with the
 * predicate it absorbed.
 *
 * ⚠ WHY AN EQUIVALENCE SPEC EXISTS AT ALL. `hasClearInfluenceLeader` is now
 * `determinedRankDepth(entries, 1) === 1`. That fold has THREE consumers
 * (`resolveDriverSemanticLabels`, `canvas/nodes/OptionNode.tsx`, and — until
 * this change — `canvas/hooks/useNodeDisplayMetadata.ts`), so "the two agree"
 * is a claim about live product behaviour, not a refactoring detail. It is
 * therefore MEASURED against the pre-fold implementation held below as a
 * reference oracle, over a hand corpus of the historically-measured cases AND
 * a randomised corpus, rather than argued from the code.
 *
 * The oracle is a VERBATIM copy of the implementation as it stood at
 * 86786efb4b59b2f18dd2c30d618043d3f0ec7b04. It is a historic record of what
 * shipped, not a fixture to keep current: if a future change to the tie notion
 * makes this spec RED, the honest move is to state the behaviour change, not
 * to edit the oracle to agree.
 */
import { describe, it, expect } from 'vitest'
import {
  determinedRankDepth,
  hasClearInfluenceLeader,
  INFLUENCE_TIE_EPSILON,
} from '../driverDisplayModel'

/** VERBATIM pre-fold `hasClearInfluenceLeader` (86786efb). Do not edit. */
function hasClearInfluenceLeaderAtPristine(
  entries: ReadonlyArray<{ id: string; value: number }>,
): boolean {
  if (entries.length === 0) return false
  const safe = entries.map((e) => ({
    id: e.id,
    value: Number.isFinite(e.value) ? e.value : 0,
  }))
  const max = Math.max(...safe.map((e) => e.value))
  const idsAtTop = new Set(
    safe.filter((e) => max - e.value <= INFLUENCE_TIE_EPSILON).map((e) => e.id),
  )
  return idsAtTop.size === 1
}

const entries = (...pairs: Array<[string, number]>) =>
  pairs.map(([id, value]) => ({ id, value }))

/**
 * The historically-measured cases, each named by the defect that produced it.
 * These are records of real observed sets — append to them, do not rewrite.
 */
const HISTORIC_CORPUS: Array<{ name: string; input: Array<{ id: string; value: number }> }> = [
  { name: 'empty set', input: [] },
  { name: 'single factor (no runner-up)', input: entries(['a', 0.4]) },
  {
    name: 'the live 8-factor model, 2026-09-03: {1.00, 0.67 x6, 0.00}',
    input: entries(
      ['fac_a', 1.0], ['fac_b', 0.67], ['fac_c', 0.67], ['fac_d', 0.67],
      ['fac_e', 0.67], ['fac_f', 0.67], ['fac_g', 0.67], ['fac_h', 0.0],
    ),
  },
  {
    name: 'the 2026-08-30 degenerate draft: five byte-identical factors',
    input: entries(
      ['fac_e_regulatory', 0.8333333333333334], ['fac_c_pricing', 0.8333333333333334],
      ['fac_a_migration', 0.8333333333333334], ['fac_d_churn', 0.8333333333333334],
      ['fac_b_headcount', 0.8333333333333334],
    ),
  },
  {
    name: 'the #964 duplicated-row case: [a@1.0, a@1.0, c@0.4] — a factor is not tied with itself',
    input: entries(['a', 1.0], ['a', 1.0], ['c', 0.4]),
  },
  // ⚠ THE COMPARISON IS EXACT FLOAT, AND THE OBVIOUS "exactly epsilon" PAIR IS NOT.
  // `1.0 - (1.0 - 0.01)` evaluates to 0.010000000000000009, which IS greater than
  // epsilon — so that pair is CLEAR, not tied. `0.02 - 0.01` is the pair that
  // subtracts to exactly 0.01. Naming these wrongly is how a boundary case
  // quietly stops testing the boundary.
  { name: 'gap that subtracts to EXACTLY epsilon (not clear)', input: entries(['a', 0.02], ['b', 0.01]) },
  { name: 'decimal pair a hair OVER epsilon (clear)', input: entries(['a', 1.0], ['b', 1.0 - INFLUENCE_TIE_EPSILON]) },
  { name: 'gap comfortably over epsilon (clear)', input: entries(['a', 1.0], ['b', 0.98]) },
  { name: 'gap comfortably under epsilon (not clear)', input: entries(['a', 0.5], ['b', 0.495]) },
  { name: 'a clear leader over a tied pack', input: entries(['a', 1.0], ['b', 0.3], ['c', 0.3]) },
  { name: 'a fully determined spread', input: entries(['a', 1.0], ['b', 0.8], ['c', 0.6], ['d', 0.4]) },
  { name: 'non-finite values coerce to 0', input: entries(['a', Number.NaN], ['b', 0.5]) },
  { name: 'duplicate id NOT at the top', input: entries(['a', 1.0], ['b', 0.5], ['b', 0.5]) },
  { name: 'every value identical at zero', input: entries(['a', 0], ['b', 0], ['c', 0]) },
]

describe('determinedRankDepth — equivalence with the predicate it absorbed', () => {
  it.each(HISTORIC_CORPUS)('agrees with the pristine oracle: $name', ({ input }) => {
    expect(hasClearInfluenceLeader(input)).toBe(hasClearInfluenceLeaderAtPristine(input))
  })

  it('agrees with the pristine oracle over a randomised corpus (seeded, 4000 sets)', () => {
    // Deterministic LCG — a fixed seed, so a failure is reproducible and the
    // corpus is identical on every machine and every run.
    let seed = 0x5eed1234
    const next = () => {
      seed = (seed * 1664525 + 1013904223) >>> 0
      return seed / 0x100000000
    }
    // Values are quantised onto a grid straddling the epsilon boundary, so the
    // corpus actually EXERCISES the boundary instead of sampling around it.
    const grid = [0, 0.005, 0.01, 0.015, 0.2, 0.205, 0.5, 0.99, 0.995, 1.0]
    let agreements = 0
    let sawClear = 0
    let sawTied = 0
    for (let i = 0; i < 4000; i += 1) {
      const size = Math.floor(next() * 6)
      const input = Array.from({ length: size }, () => ({
        // A small id pool, so duplicate ids arise naturally and often.
        id: `f${Math.floor(next() * 4)}`,
        value: grid[Math.floor(next() * grid.length)],
      }))
      const mine = hasClearInfluenceLeader(input)
      const oracle = hasClearInfluenceLeaderAtPristine(input)
      expect(mine).toBe(oracle)
      agreements += 1
      if (oracle) sawClear += 1
      else sawTied += 1
    }
    // ⚠ THE CORPUS MUST DISCRIMINATE. A generator that only ever produced ties
    // (or only clear leaders) would agree with any oracle whatsoever and prove
    // nothing — the agreement above is evidence only because BOTH verdicts are
    // well represented in it.
    expect(agreements).toBe(4000)
    expect(sawClear).toBeGreaterThan(400)
    expect(sawTied).toBeGreaterThan(400)
  })
})

describe('determinedRankDepth — the widened gate', () => {
  it('THE DEFECT: the live {1.00, 0.67 x6, 0.00} set determines rank 1 ONLY', () => {
    const live = entries(
      ['fac_a', 1.0], ['fac_b', 0.67], ['fac_c', 0.67], ['fac_d', 0.67],
      ['fac_e', 0.67], ['fac_f', 0.67], ['fac_g', 0.67], ['fac_h', 0.0],
    )
    // The leader IS clear — which is exactly why the old gate passed and then
    // licensed #2 and #3 as well.
    expect(hasClearInfluenceLeader(live)).toBe(true)
    expect(determinedRankDepth(live, 3)).toBe(1)
  })

  it('OPPOSITE-DIRECTION TWIN: a genuinely determined set still determines all three', () => {
    const determined = entries(['a', 1.0], ['b', 0.8], ['c', 0.6], ['d', 0.4])
    expect(determinedRankDepth(determined, 3)).toBe(3)
  })

  it('stops at the FIRST undetermined rank — a #3 is never printed without a #2', () => {
    // Ranks 1 and 2 are clear; 2 and 3 are tied. Depth must be 1, not 3:
    // rank 2's ordinal is the one that fails, so nothing below it may claim one.
    const input = entries(['a', 1.0], ['b', 0.7], ['c', 0.7], ['d', 0.1])
    expect(determinedRankDepth(input, 3)).toBe(1)
  })

  it('determines rank 1 and 2 but not 3 when the tie starts at rank 3', () => {
    const input = entries(['a', 1.0], ['b', 0.7], ['c', 0.4], ['d', 0.4])
    expect(determinedRankDepth(input, 3)).toBe(2)
  })

  it('a set smaller than the cap is fully determined when every gap is clear', () => {
    expect(determinedRankDepth(entries(['a', 1.0], ['b', 0.5]), 3)).toBe(2)
    expect(determinedRankDepth(entries(['a', 1.0]), 3)).toBe(1)
  })

  it('respects the cap: never reports a depth beyond maxDepth', () => {
    const input = entries(['a', 1.0], ['b', 0.8], ['c', 0.6], ['d', 0.4], ['e', 0.2])
    expect(determinedRankDepth(input, 3)).toBe(3)
    expect(determinedRankDepth(input, 2)).toBe(2)
    expect(determinedRankDepth(input, 0)).toBe(0)
  })

  it('duplicate ids collapse: a factor is not tied with itself at ANY depth', () => {
    // Without the collapse, `b` would appear to be tied with `b` and cut the
    // depth to 1. Binding by identity is what makes depth 2 correct here.
    const input = entries(['a', 1.0], ['b', 0.5], ['b', 0.5])
    expect(determinedRankDepth(input, 3)).toBe(2)
  })

  it('the epsilon boundary is exclusive at every rank, not just the first', () => {
    // ⚠ EXACT FLOAT, NOT DECIMAL INTUITION. `0.02 - 0.01` is one of the few
    // decimal pairs that subtracts to exactly 0.01; the intuitive
    // `0.5 - (0.5 - 0.01)` yields 0.010000000000000009 and is therefore CLEAR.
    // The first draft of this test asserted the intuition and was wrong —
    // pinned here with the real arithmetic so the boundary is actually tested.
    expect(0.02 - 0.01).toBe(INFLUENCE_TIE_EPSILON)
    const atBoundary = entries(['a', 1.0], ['b', 0.02], ['c', 0.01])
    expect(determinedRankDepth(atBoundary, 3)).toBe(1)

    // A gap comfortably over epsilon is clear at every rank.
    const overBoundary = entries(['a', 1.0], ['b', 0.5], ['c', 0.48])
    expect(determinedRankDepth(overBoundary, 3)).toBe(3)

    // …and comfortably under is clear at none below the first.
    const underBoundary = entries(['a', 1.0], ['b', 0.5], ['c', 0.495])
    expect(determinedRankDepth(underBoundary, 3)).toBe(1)
  })
})
