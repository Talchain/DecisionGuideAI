/**
 * buildV7Lenses — V7 Lane L5 pins for the passthrough lens/evidence builder.
 *
 * Every value is composed from existing resultsSectionData fields; these pins
 * lock the honest gates (goal no-target vs producer-gap, outcome availability),
 * the OptionCards-identical outcome scale, and the evidence model (est. flag,
 * flip-risk + trade-off passthrough) so no branch can silently start inventing.
 */
import { describe, it, expect } from 'vitest'
import { buildV7Lenses } from '../buildV7Lenses'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { OptionResult } from '../../types'

function opt(
  id: string,
  label: string,
  o: Partial<{
    win: number
    p10: number
    p50: number
    p90: number
    mean: number
    goalProb: number | null
  }> = {},
): OptionResult {
  return {
    id,
    label,
    expected: o.mean ?? null,
    outcome: { mean: o.mean ?? null, p10: o.p10 ?? null, p50: o.p50 ?? null, p90: o.p90 ?? null },
    p10: null,
    p50: null,
    p90: null,
    isRecommended: false,
    winProbability: o.win,
    goalProbability: o.goalProb ?? null,
  } as unknown as OptionResult
}

function data(partial: {
  allOptions: OptionResult[]
  recommendedId?: string
  goalThreshold?: number | null
  drivers?: unknown[]
  challengeFragileEdges?: unknown[]
  conditionalWinners?: unknown[]
  voiRanking?: unknown
}): ResultsSectionDataReturn {
  const recommendedOption = partial.allOptions.find((o) => o.id === partial.recommendedId) ?? null
  return {
    recommendation: {
      allOptions: partial.allOptions,
      recommendedOption,
      goalThreshold: partial.goalThreshold ?? null,
      outcomeUnit: 'count',
      outcomeUnitSymbol: undefined,
    },
    drivers: { drivers: partial.drivers ?? [] },
    confidence: {
      challengeFragileEdges: partial.challengeFragileEdges ?? [],
      conditionalWinners: partial.conditionalWinners ?? [],
    },
    voiRanking: partial.voiRanking ?? null,
  } as unknown as ResultsSectionDataReturn
}

describe('buildV7Lenses — passthrough lens + evidence model (V7 L5)', () => {
  describe('Likely outcome lens', () => {
    it('is available when options carry win probabilities', () => {
      const m = buildV7Lenses(data({ allOptions: [opt('a', 'A', { win: 0.7 }), opt('b', 'B', { win: 0.3 })] }))
      expect(m.outcome.available).toBe(true)
      expect(m.outcome.hasRange).toBe(false)
    })

    it('computes the shared scale exactly like OptionCards (p10/p90 with mean fallback)', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { p10: 10, p50: 20, p90: 30 }), opt('b', 'B', { p10: 5, p50: 12, p90: 25 })],
        }),
      )
      expect(m.outcome.hasRange).toBe(true)
      expect(m.outcome.globalMin).toBe(5)
      expect(m.outcome.globalMax).toBe(30)
    })

    it('is unavailable when no option carries a win probability or a range', () => {
      const m = buildV7Lenses(data({ allOptions: [opt('a', 'A'), opt('b', 'B')] }))
      expect(m.outcome.available).toBe(false)
    })
  })

  describe('Goal fit lens honest gates', () => {
    it('gates as no_target when no success target is set', () => {
      const m = buildV7Lenses(
        data({ allOptions: [opt('a', 'A', { goalProb: 0.6 })], goalThreshold: null }),
      )
      expect(m.goal.available).toBe(false)
      expect(m.goal.gate).toBe('no_target')
    })

    it('gates as producer_gap when a target is set but not every option has a goal probability', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { goalProb: 0.6 }), opt('b', 'B', { goalProb: null })],
          goalThreshold: 80,
        }),
      )
      expect(m.goal.available).toBe(false)
      expect(m.goal.gate).toBe('producer_gap')
    })

    it('is available with per-option probabilities when a target is set and every option has one', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { goalProb: 0.6 }), opt('b', 'B', { goalProb: 0.2 })],
          recommendedId: 'a',
          goalThreshold: 80,
        }),
      )
      expect(m.goal.available).toBe(true)
      expect(m.goal.gate).toBe('none')
      // ⭐ AMENDED (ROADMAP 2.334): `nValidSamples` is now carried on every
      // goal-lens row so the rows can resolve sub-1% figures instead of
      // printing one floor string for all of them. This fixture's `opt()`
      // helper supplies no sample count, so the value is `null` — absent, NOT
      // defaulted, which is the behaviour that keeps a run without a count on
      // the floor arm rather than inventing a resolution.
      //
      // `toEqual` (exact shape) is kept deliberately over `toMatchObject`:
      // this assertion is the reason the field addition was caught at all,
      // and loosening it to make the failure go away would remove the guard
      // that noticed. A future field addition SHOULD red this test.
      expect(m.goal.options).toEqual([
        { id: 'a', label: 'A', goalProbability: 0.6, nValidSamples: null, isWinner: true, goalFitIsSubstitutedJoint: false },
        { id: 'b', label: 'B', goalProbability: 0.2, nValidSamples: null, isWinner: false, goalFitIsSubstitutedJoint: false },
      ])
    })
  })

  describe('Evidence model', () => {
    it('tags a driver "est." from a defaulted value or confidence (producer boolean, not a threshold)', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { win: 0.6 })],
          drivers: [
            { factorKey: 'f1', factorLabel: 'Price', direction: 'negative', isDefaultedConfidence: true, canFocus: false },
            { factorKey: 'f2', factorLabel: 'Demand', direction: 'positive', valueDefaulted: false, canFocus: true, matchedNodeId: 'n2' },
          ],
        }),
      )
      expect(m.evidence.drivers[0]).toMatchObject({ label: 'Price', direction: 'negative', isEstimate: true, focusId: undefined })
      expect(m.evidence.drivers[1]).toMatchObject({ label: 'Demand', direction: 'positive', isEstimate: false, focusId: 'n2' })
    })

    it('passes flip risks through from challengeFragileEdges unchanged', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { win: 0.6 })],
          challengeFragileEdges: [{ from_id: 'n1', from_label: 'Price', to_label: 'Profit', switch_probability: 0.48 }],
        }),
      )
      expect(m.evidence.flipRisks).toEqual([
        { fromId: 'n1', fromLabel: 'Price', toLabel: 'Profit', switchProbability: 0.48 },
      ])
    })

    it('passes to_id + edge_id through so the analysis-graph projection can resolve the canvas edge', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { win: 0.6 })],
          challengeFragileEdges: [
            { edge_id: 'plot-e-9', from_id: 'n1', to_id: 'n2', from_label: 'Price', to_label: 'Profit', switch_probability: 0.48 },
          ],
        }),
      )
      expect(m.evidence.flipRisks[0].fromId).toBe('n1')
      expect(m.evidence.flipRisks[0].toId).toBe('n2')
      expect(m.evidence.flipRisks[0].edgeId).toBe('plot-e-9')
    })

    it('narrates trade-offs from conditional_winners producer values (nothing invented)', () => {
      const m = buildV7Lenses(
        data({
          allOptions: [opt('a', 'A', { win: 0.6 })],
          conditionalWinners: [
            {
              factor_label: 'Interest rate',
              factor_id: 'n7',
              split_value: 5,
              split_unit: '%',
              high_bucket: { winner_label: 'Rent', win_probability: 0.6 },
              low_bucket: { winner_label: 'Buy', win_probability: 0.7 },
            },
          ],
        }),
      )
      expect(m.evidence.tradeOffs).toEqual([
        { factorLabel: 'Interest rate', factorId: 'n7', splitValue: 5, splitUnit: '%', highWinnerLabel: 'Rent', lowWinnerLabel: 'Buy' },
      ])
    })

    it('yields empty evidence collections when the backing fields are absent', () => {
      const m = buildV7Lenses(data({ allOptions: [opt('a', 'A', { win: 0.6 })] }))
      expect(m.evidence.drivers).toEqual([])
      expect(m.evidence.flipRisks).toEqual([])
      expect(m.evidence.tradeOffs).toEqual([])
    })
  })
})

/**
 * V7-C slice 1 (ROADMAP 2.141) — `evidence.resolveNext` is a PASSTHROUGH.
 *
 * The one authority on what the ranking says is `voi/voiRanking.ts`, and it is
 * pinned there. What matters here is that this builder adds NOTHING: no
 * re-sort, no re-group, no filter, no derived fallback. A second derivation in
 * this file would be the hand-maintained mirror trap 12 warns about, and a
 * re-sort is the exact defect the producer-order doctrine forbids.
 */
describe('buildV7Lenses — resolveNext passthrough (V7-C slice 1)', () => {
  const RANKING = {
    resolved: [
      { factorId: 'n_comp', label: 'Competitor response', canFocus: true },
      { factorId: 'n_market', label: 'Market receptivity', canFocus: true },
    ],
    belowResolution: [{ factorId: 'n_hiring', label: 'Hiring pace', canFocus: true }],
    someFactorsUnassessed: true,
  }

  it('carries the hook verdict through REFERENCE-IDENTICAL — nothing re-derived', () => {
    const m = buildV7Lenses(data({ allOptions: [], voiRanking: RANKING }))
    // Reference identity is the strongest available proof that no copy, filter
    // or re-sort happened between the hook and the view.
    expect(m.evidence.resolveNext).toBe(RANKING)
  })

  it('carries a deliberately MIS-SORTED order verbatim', () => {
    const m = buildV7Lenses(data({ allOptions: [], voiRanking: RANKING }))
    expect(m.evidence.resolveNext?.resolved.map((r) => r.label)).toEqual([
      'Competitor response',
      'Market receptivity',
    ])
  })

  it('carries the honest-gate verdict (null) rather than inventing an empty ranking', () => {
    const m = buildV7Lenses(data({ allOptions: [], voiRanking: null }))
    expect(m.evidence.resolveNext).toBeNull()
  })

  it('never substitutes a driver-derived ranking when the hook returned null', () => {
    // The retired regime built a "most valuable next step" from a heuristic
    // when the real estimator was absent. That fallback must not exist here.
    const m = buildV7Lenses(
      data({
        allOptions: [],
        voiRanking: null,
        drivers: [
          { factorKey: 'n_market', factorLabel: 'Market receptivity', direction: 'positive' },
          { factorKey: 'n_comp', factorLabel: 'Competitor response', direction: 'negative' },
        ],
      }),
    )
    expect(m.evidence.resolveNext).toBeNull()
    // POSITIVE CONTROL: those drivers really are present on the model, so the
    // null above is a refusal to substitute — not an empty fixture.
    expect(m.evidence.drivers.map((d) => d.label)).toEqual([
      'Market receptivity',
      'Competitor response',
    ])
  })
})
