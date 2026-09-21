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

const flipRec = (inputs: StrengthenInputs) =>
  buildRecommendations(inputs).find((r) => r.id.startsWith('strengthen:flip:'))

describe('the flip card states the measured condition', () => {
  /**
   * ⚠ PRECONDITION, NOT DECORATION. Every assertion below reads `rec.signal`.
   * If the trigger stopped firing — a gate moved, the shape changed — each one
   * would throw on `undefined` rather than pass, but the failure would name the
   * wrong thing. This names it.
   */
  it('PRECONDITION: the fixture actually raises the flip recommendation', () => {
    const rec = flipRec(withFragileEdge('Hire Two Mid-Level Developers'))
    expect(rec, 'the flip trigger did not fire, so every assertion below is void').toBeDefined()
    expect(rec?.signal.length ?? 0).toBeGreaterThan(20)
  })

  it('names the condition the denominator is', () => {
    const rec = flipRec(withFragileEdge('Hire Two Mid-Level Developers'))
    expect(rec?.signal).toContain('came out weak')
  })

  it('names the alternative and the rate the producer measured', () => {
    const rec = flipRec(withFragileEdge('Hire Two Mid-Level Developers'))
    expect(rec?.signal).toContain('Hire Two Mid-Level Developers')
    expect(rec?.signal).toContain('52%')
  })

  /**
   * ⛔ THE OPPOSITE-DIRECTION TWIN of the two above. Without it, a sentence that
   * appended the condition to the original forecast would satisfy every
   * positive assertion while still telling the reader the number is a chance of
   * something happening if a factor moves.
   */
  it('does NOT state it as a forecast, and does not describe the field next door', () => {
    const signal = flipRec(withFragileEdge('Hire Two Mid-Level Developers'))?.signal ?? ''
    expect(signal.toLowerCase()).not.toContain('chance')
    expect(signal.toLowerCase()).not.toContain('shifts')
    expect(signal.toLowerCase()).not.toContain('changed the answer')
  })

  /**
   * ⚠ THE PRODUCER MAY OMIT `alternative_winner_label`, and the sentence that
   * names an alternative it does not have would be inventing the most
   * persuasive part. The condition must survive that branch too — it is where
   * the sibling file's own retired wording once survived a fix (see
   * `assumedStrengthCopy.ts`).
   */
  it('keeps the condition on the branch that cannot name an alternative', () => {
    const signal = flipRec(withFragileEdge(undefined))?.signal ?? ''
    expect(signal).toContain('came out weak')
    expect(signal).toContain('a different option')
    expect(signal.toLowerCase()).not.toContain('chance')
  })
})

describe('the two surfaces read ONE sentence, so they cannot drift', () => {
  /**
   * ⭐ THE ANTI-FORK ASSERTION. The elicitation card and the Strengthen card
   * describe the same producer field. Before this change they described it
   * differently — one conditional, one a forecast — and nothing could see it,
   * because each was correct-looking in its own file. This binds them to the
   * same builder: a second spelling anywhere REDs here.
   */
  it('the Strengthen signal IS the shared builder, with its own referent', () => {
    const rec = flipRec(withFragileEdge('Hire Two Mid-Level Developers'))
    expect(rec?.signal).toBe(
      strongerOptionInWeakRuns(0.52, 'Hire Two Mid-Level Developers', 'that assumption'),
    )
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
