/**
 * ⭐⭐ ONE PRODUCER FIELD, ONE SENTENCE — because the two surfaces that describe
 * it had it swapped with the field next door.
 *
 * ── THE PRODUCER, FETCHED AND QUOTED ───────────────────────────────────────
 * `Talchain/Inference-Service-Layer` `staging`, `src/models/response_v2.py`:
 *
 *   :569-575  switch_probability
 *             "Proportion of MC samples where alternative wins WHEN EDGE IS
 *              WEAK. 0.0 if same option wins (stable), null only if no data
 *              available."
 *   :576-580  marginal_switch_probability
 *             "Probability of decision flip when ONLY this edge varies …"
 *
 * ── THE DEFECT, TWICE ──────────────────────────────────────────────────────
 * The UI reads ONLY `switch_probability`. Two surfaces described it as though
 * it were the other one:
 *
 *   · the uncertainty column's caption — "Bars show how often each assumption
 *     changed the answer" (fixed by #1798)
 *   · this card's flip signal — "NN% chance {alt} scores highest instead if
 *     {factor} shifts"
 *
 * ⛔ NEITHER WAS VAGUE. Both are accurate descriptions of
 * `marginal_switch_probability`, which nothing renders. The condition — the
 * denominator is the runs where the link came out weak, its bottom quartile —
 * was dropped, and with it the only thing that makes the number readable.
 *
 * ⚠ AND THE ROOT WAS A COMMENT. `results/types.ts` documented the field as
 * *"P(flipping this edge switches the recommended option)"*, i.e. the twin.
 * Both wrong sentences are downstream of it. That comment is corrected in the
 * same change; this file is what keeps the correction from being optional.
 *
 * ⚠ WHY THE ASSERTIONS ARE ABOUT THE CONDITION AND NOT ABOUT A STRING. A
 * verbatim pin would RED on any reword, including a better one. What may not
 * change is that the sentence CARRIES ITS CONDITION and does not state a
 * forecast — so each positive assertion has an opposite-direction twin naming
 * the exact shape that shipped.
 *
 * ⛔ THE STRENGTHEN FLIP CARD IS RETIRED (Reasoning Coach 5931857395 +
 * 5932849641). Even with its condition stated, readers took the conditional
 * `switch_probability` as the link's effect. Its content rows are gone; the
 * rows below pin that it is not produced and that its sentence reaches no
 * Strengthen rec. The elicitation card keeps the shared builder.
 */
import { describe, it, expect } from 'vitest'
import { buildRecommendations } from '../buildRecommendations'
import { assumedStrengthWhy, strongerOptionInWeakRuns } from '../../strengthElicitation/assumedStrengthCopy'
import type { StrengthenInputs } from '../strengthenTypes'

const baseInputs: StrengthenInputs = {
  goalThreshold: 62,
  analysisComplete: true,
  flipThresholds: null,
  fragileEdges: [],
  factors: [],
  robustness: { status: null, level: null },
  biasFindingTypes: [],
  phase3Items: [],
}

const withFragileEdge = (alternativeWinnerLabel?: string): StrengthenInputs => ({
  ...baseInputs,
  fragileEdges: [
    {
      edgeId: 'e_pitch_to_revenue',
      factorLabel: 'Pitch Quality',
      switchProbability: 0.52,
      ...(alternativeWinnerLabel !== undefined ? { alternativeWinnerLabel } : {}),
    },
  ],
})

describe('the flip card is retired', () => {
  it('RETIRED: a flip-bearing run raises no strengthen:flip rec', () => {
    const input: StrengthenInputs = {
      ...withFragileEdge('Hire Two Mid-Level Developers'),
      hasLeadingOption: true,
      robustness: { status: 'computed', level: 'low' },
    }
    const ids = buildRecommendations(input).map((r) => r.id)
    // CONTROL: the fragile edge is in the inputs, and the builder still runs.
    expect(input.fragileEdges.map((e) => e.edgeId)).toEqual(['e_pitch_to_revenue'])
    expect(ids).toContain('strengthen:robustness')
    expect(ids.filter((i) => i.startsWith('strengthen:flip'))).toEqual([])
  })
})

describe('the two surfaces read ONE sentence, so they cannot drift', () => {
  /**
   * ⛔ ONE SURFACE NOW. The Strengthen card that shared this builder is retired
   * (Reasoning Coach 5931857395 + 5932849641), so its sentence must reach no
   * Strengthen rec under any id, bound by the exact string it used to render.
   */
  it('RETIRED: no Strengthen rec carries the shared sentence', () => {
    const input: StrengthenInputs = {
      ...withFragileEdge('Hire Two Mid-Level Developers'),
      hasLeadingOption: true,
      robustness: { status: 'computed', level: 'low' },
    }
    const recs = buildRecommendations(input)
    const retired = strongerOptionInWeakRuns(0.52, 'Hire Two Mid-Level Developers', 'that assumption')
    // CONTROL: the sentence is real, and the build has recs to sweep.
    expect(retired).toContain('came out weak')
    expect(recs.map((r) => r.id)).toContain('strengthen:robustness')
    for (const r of recs) {
      expect([r.title, r.signal, r.whyNow, r.tryThis ?? ''], r.id).not.toContain(retired)
    }
  })

  it('the elicitation card IS the same builder, with ITS referent', () => {
    const why = assumedStrengthWhy({
      switchProbability: 0.52,
      alternativeWinnerLabel: 'Hire Two Mid-Level Developers',
    } as unknown as Parameters<typeof assumedStrengthWhy>[0])
    expect(why.startsWith(strongerOptionInWeakRuns(0.52, 'Hire Two Mid-Level Developers', 'that link'))).toBe(true)
  })

  /**
   * ⛔ CONTRAST CONTROL for the pair above. If `strongerOptionInWeakRuns`
   * ignored its `subject` argument, both assertions would still pass and the
   * "one sentence, the caller's own referent" claim would be false. This proves
   * the parameter discriminates.
   */
  it('PRECONDITION: the subject parameter actually changes the sentence', () => {
    expect(strongerOptionInWeakRuns(0.52, 'X', 'that link')).not.toBe(
      strongerOptionInWeakRuns(0.52, 'X', 'that assumption'),
    )
    expect(strongerOptionInWeakRuns(0.52, 'X', 'that link')).toContain('that link')
    expect(strongerOptionInWeakRuns(0.52, 'X', 'that assumption')).toContain('that assumption')
  })
})
