/**
 * Analysis (New) — the decision-level VOI copy answers to the ceiling its
 * OWNING module documents.
 *
 * ⚠ WHY THIS FILE EXISTS. `analysisNewCopy.decisionVoi` is authored off the
 * SAME verdict source as `RESOLVE_NEXT_COPY.decisionNotZero` — both are
 * `readDecisionVoi` in `voi/decisionVoi.ts`, i.e. `Number.isFinite(raw) && raw
 * !== 0`. The owner documents, in terms, that this verdict does NOT license a
 * value claim: `decision_evpi` arrives with no noise floor, no CI and no
 * `n_samples`, so a small positive is not distinguishable from estimator noise.
 * This surface shipped 'Resolving the open unknowns could still change this
 * decision' — which is that claim.
 *
 * The ceiling is IMPORTED from the owner, never restated here. A copied
 * doctrine list is the hand-maintained mirror (CLAUDE.md trap 12), and the
 * breach above is what happens when a limit is only reachable by one consumer.
 */

import { describe, expect, it } from 'vitest'

import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import {
  RESOLVE_NEXT_COPY,
  UNLICENSED_SIGNIFICANCE_CLAIMS,
} from '../../voi/resolveNextCopy'

/**
 * Every decision-level string this surface can render — the two verdict
 * sentences AND the heading above them.
 *
 * ⚠ THE LABEL IS IN THE LIST BECAUSE IT SHIPS ON THE SAME SURFACE, OFF THE SAME
 * VERDICT. It was added to give the sentence a subject (it rendered as an
 * unlabelled orphan), and a heading is exactly where a significance claim would
 * be easiest to smuggle in — "Worth learning more" would read as a section name
 * and assert the thing the ceiling forbids. Naming the MEASURE is licensed;
 * naming its MAGNITUDE is not, and only this list can tell the two apart.
 */
const DECISION_LEVEL: ReadonlyArray<readonly [string, string]> = [
  ['measuredNonZero', ANALYSIS_NEW_COPY.decisionVoi.measuredNonZero],
  ['measuredZero', ANALYSIS_NEW_COPY.decisionVoi.measuredZero],
  ['label', ANALYSIS_NEW_COPY.decisionVoi.label],
]

describe("the ceiling instrument can see the breach that actually shipped", () => {
  /**
   * ⭐ POSITIVE CONTROL, AND IT IS THE LOAD-BEARING ONE. The eight patterns the
   * list carried before 2026-08-28 did NOT match the shipped sentence: a guard
   * that cannot fail on the defect it is being cited for proves nothing. This
   * test pins that the list can now fail on it, so a later trim of the list
   * REDs here rather than silently re-permitting the sentence.
   */
  const SHIPPED_BREACH = 'Resolving the open unknowns could still change this decision.'

  it('the shipped sentence IS matched by the imported ceiling', () => {
    expect(
      UNLICENSED_SIGNIFICANCE_CLAIMS.some((p) => p.test(SHIPPED_BREACH)),
      'the ceiling must be capable of failing the sentence this test exists about',
    ).toBe(true)
  })

  it('the exemplar overclaim the owner names is ALSO matched (the list was not narrowed to one case)', () => {
    expect(
      UNLICENSED_SIGNIFICANCE_CLAIMS.some((p) =>
        p.test('Measured for the decision as a whole, there is value in learning more.'),
      ),
    ).toBe(true)
  })

  /**
   * ⭐ DISCRIMINATION, NOT JUST SENSITIVITY. A list that matched everything
   * would pass both controls above and be useless. The owner's own licensed
   * sentences must survive it — they are the negative case that proves the
   * ceiling bans a CLAIM rather than a topic.
   */
  it('the owner’s own licensed sentences are NOT matched', () => {
    for (const s of [RESOLVE_NEXT_COPY.decisionNotZero, RESOLVE_NEXT_COPY.decisionZero]) {
      const hit = UNLICENSED_SIGNIFICANCE_CLAIMS.find((p) => p.test(s))
      expect(hit, `owner sentence wrongly banned by ${String(hit)}`).toBeUndefined()
    }
  })
})

describe('Analysis (New) decision-level copy stays inside the ceiling', () => {
  it.each(DECISION_LEVEL)('%s makes no unlicensed significance claim', (name, copy) => {
    const hit = UNLICENSED_SIGNIFICANCE_CLAIMS.find((p) => p.test(copy))
    expect(hit, `${name} ("${copy}") breaches the ceiling via ${String(hit)}`).toBeUndefined()
  })

  /**
   * The positive half. Banning the overclaim is not the same as making the
   * licensed claim: a sentence could pass every pattern above by saying nothing
   * at all. The owner's licensed framing is "did not come back at zero", and
   * this surface must use it rather than a paraphrase that drifts back towards
   * significance.
   *
   * ⚠ The owner's `decisionNotZero` is NOT reused verbatim here, deliberately.
   * Its second half ("This ranking scores unknowns one at a time…") is a SCOPE
   * statement about the per-factor ranking on the Resolve-next surface. There
   * is no such ranking on this surface, so importing it would import a claim
   * about a thing that is not on screen.
   */
  it('the non-zero sentence keeps the owner’s LICENSED framing', () => {
    expect(ANALYSIS_NEW_COPY.decisionVoi.measuredNonZero.toLowerCase()).toContain(
      'did not come back at zero',
    )
  })

  it('the non-zero sentence attributes the measurement to THE DECISION AS A WHOLE', () => {
    // `factor_evppi` answers "what is one unknown worth on its own";
    // `decision_evpi` answers "what is resolving everything worth". A sentence
    // that drops the scope reads as a claim about the factors listed above it.
    //
    // ⚠ SCOPE OF THIS ASSERTION, STATED. It binds `measuredNonZero` ONLY.
    // `measuredZero` ('Resolving the open unknowns was measured as not changing
    // this decision.') also omits the estimand scope, and its claim IS licensed
    // — a measured zero is a real result the contract permits stating. Widening
    // this test to cover it would be a copy change outside the gate this lane
    // was briefed on, so it is REPORTED rather than edited. Adding it later is
    // a tightening; this comment exists so the omission is deliberate and
    // visible rather than an oversight a reader has to rediscover.
    expect(ANALYSIS_NEW_COPY.decisionVoi.measuredNonZero.toLowerCase()).toContain(
      'for the decision as a whole',
    )
  })

  /**
   * ⭐ THE DISCRIMINATION FOR THE LABEL SPECIFICALLY. Passing the pattern list
   * is necessary and not sufficient: a heading of "Notes" would pass it and
   * would not give the sentence a subject, which is the whole reason the label
   * exists. So this pins that the label NAMES THE MEASURE — and, as its twin,
   * that the nearest banned phrasing really is banned, so the pair fails on
   * different assertions if either half rots.
   */
  it('the label names the measure, and the phrasing it was NOT given is genuinely banned', () => {
    expect(ANALYSIS_NEW_COPY.decisionVoi.label.toLowerCase()).toContain('value of information')
    expect(
      UNLICENSED_SIGNIFICANCE_CLAIMS.some((p) => p.test('Worth learning more')),
      'the near-miss heading must be refused by the imported ceiling, or the label test proves nothing',
    ).toBe(true)
  })

  it('neither sentence carries a digit (the magnitude is in unlicensed outcome units)', () => {
    for (const [name, copy] of DECISION_LEVEL) {
      expect(copy, `${name} carries a number`).not.toMatch(/\d/)
    }
  })
})
