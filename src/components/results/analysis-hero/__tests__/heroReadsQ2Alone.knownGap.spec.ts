/**
 * ⚠⚠ THIS FILE PINS A DEFECT, NOT A BEHAVIOUR. READ THE WHOLE HEADER BEFORE
 * "FIXING" THE TEST.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT IS WRONG
 * ═══════════════════════════════════════════════════════════════════════════
 * `useResultsSectionData` composes the leader authority from two questions
 * with deliberately OPPOSITE absence arms:
 *
 *   Q1  may the MODEL license a comparative-leader claim?  (the CEE lattice)
 *   Q2  did THIS RUN separate the arms?                    (the verdict)
 *   composed = Q1 && Q2, published as `leaderDesignationPermitted`
 *
 * `buildHeroModel.ts:279` reads **Q2 ALONE**:
 *
 *   const designationsWithheld =
 *     recommendation.verdict != null && !recommendation.verdict.hasLeadingOption
 *
 * So on a run where the arms separated but the MODE licenses no comparative
 * claim (`exploratory` / `none`), the hero does not withhold. Measured below:
 * `designationsWithheld: false` with every row `isRanked: true`, which
 * `AnalysisHeroPanel:485` turns into visible ordinals
 * (`showOrdinal={!model.designationsWithheld && row.isRanked}`) — on the SAME
 * TAB whose checks footer reads "Leading option not assessed".
 *
 * That is this estate's signature defect (CLAUDE.md trap 21): two authorities
 * answering what looks like one question, diverging on the mode that separates
 * them. It is the same defect class as the three prose sites
 * `analysisClaimPolicy` was built to close — and it is NOT closed.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHY IT IS PINNED RATHER THAN FIXED
 * ═══════════════════════════════════════════════════════════════════════════
 * The one-line widening is obvious and the composed field is already in scope
 * on `recommendation`. What is NOT settled is its blast radius:
 * `designationsWithheld` drives ORDER (`sortOptionsForDisplay`), ORDINALS, the
 * CROWN and `HERO_COPY.evidence.flipRisksNote`; 25 specs under this directory
 * reference `buildHeroModel` or the flag. Over-suppression across the hero is
 * the WORSE of the two defects, and shipping an unmeasured widening of a
 * suppression is exactly how this seam has been broken before. The lane that
 * found this could not measure that suite (machine load 30, over the local
 * gate's own void threshold of 25), and an unmeasured widening is not a fix —
 * it is a second defect with better intentions.
 *
 * So the gap is made VISIBLE instead of left silent: the estate's own rule for
 * a known gap is an explicit pinned set with a test asserting EXACTLY that set,
 * so the suite stays green FOR THE RIGHT REASON and REDs if the set grows or
 * shrinks. A gap recorded in the suite is honest; a gap invisible to it is how
 * this one survived three prose fixes in the same wave.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT SETTLES IT
 * ═══════════════════════════════════════════════════════════════════════════
 *   1. Change `buildHeroModel.ts:279` to
 *        recommendation.verdict != null
 *        && (!recommendation.verdict.hasLeadingOption
 *            || recommendation.leaderDesignationPermitted === false)
 *      — strictly a widening, and the `=== false` keeps the absence arm every
 *      other consumer of this authority uses.
 *   2. Run the FULL hero suite on CI (not locally under load) and account for
 *      every change, in BOTH directions.
 *   3. Add the anti-vacuity twin: a `comparative_leader` run must still rank,
 *      crown and number exactly as it does today.
 *   4. DELETE THIS FILE. It will RED the moment the gap closes, and that RED is
 *      the signal to remove it — not to re-pin the new behaviour.
 */
import { describe, expect, it } from 'vitest'
import { buildHeroModel } from '../buildHeroModel'
import { makeHeroData } from '../__fixtures__/hero.fixtures'
import type { DecisionVerdict } from '../../../../lib/decisionVerdict'

/** Arms separated — Q2 is TRUE. */
const SEPARATED: DecisionVerdict = {
  leaderId: 'opt_b',
  separation: 'clear',
  hasLeadingOption: true,
  gapPp: 40,
  source: 'producer_band',
}

/**
 * The divergent run: Q2 true, Q1 false, so the COMPOSED authority the hook
 * publishes is `false` — the hero should withhold and does not.
 */
const divergentRun = () =>
  makeHeroData({
    recommendation: {
      verdict: SEPARATED,
      leaderDesignationPermitted: false,
      analysisAdmission: { permitted_analysis_mode: 'exploratory', reasons: [] },
    } as never,
  })

/** The same run with the mode licensing the claim — the CONTRAST. */
const licensedRun = () =>
  makeHeroData({
    recommendation: {
      verdict: SEPARATED,
      leaderDesignationPermitted: true,
      analysisAdmission: { permitted_analysis_mode: 'comparative_leader', reasons: [] },
    } as never,
  })

describe('KNOWN GAP — buildHeroModel reads Q2 alone, not the composed authority', () => {
  it('PRECONDITION: the two fixtures differ ONLY in the composed authority', () => {
    // Pin it in-test. Without this the arm below could pass because the
    // fixture stopped reproducing the state it names, and a gap pinned on a
    // fixture that no longer diverges is a tautology (CLAUDE.md trap 13b).
    const a = divergentRun().recommendation
    const b = licensedRun().recommendation
    expect(a.verdict?.hasLeadingOption).toBe(true)
    expect(b.verdict?.hasLeadingOption).toBe(true)
    expect(a.leaderDesignationPermitted).toBe(false)
    expect(b.leaderDesignationPermitted).toBe(true)
  })

  it('⚠ PINNED DEFECT: the hero does NOT withhold when only the MODE withholds', () => {
    const model = buildHeroModel(divergentRun())
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') return
    // ⚠ `false` IS THE DEFECT. When this line REDs, the gap has closed —
    // delete this file rather than updating the expectation.
    expect(
      model.designationsWithheld,
      'buildHeroModel now honours the composed authority — the gap is CLOSED. '
        + 'Delete this file; do not re-pin the new behaviour.',
    ).toBe(false)
    // …and the user-visible consequence, so the pin is about the SURFACE and
    // not only about an internal flag: ranked rows are what
    // `AnalysisHeroPanel:485` turns into ordinals.
    expect(model.rows.length).toBeGreaterThan(0)
    expect(model.rows.every((r) => r.isRanked)).toBe(true)
  })

  it('CONTRAST: a licensed run designates — so the pin above is about the GAP', () => {
    // Without this, "designationsWithheld === false" would be consistent with a
    // hero that never withholds anything, and the pin would say nothing about
    // Q1 at all.
    const model = buildHeroModel(licensedRun())
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') return
    expect(model.designationsWithheld).toBe(false)
  })

  it('THE HALF THAT DOES WORK: Q2 false still withholds, and that must not regress', () => {
    // The gap is Q1-shaped only. Whatever fix lands must keep this true.
    const model = buildHeroModel(
      makeHeroData({
        recommendation: {
          verdict: { ...SEPARATED, hasLeadingOption: false, separation: 'unknown' },
          leaderDesignationPermitted: false,
        } as never,
      }),
    )
    expect(model.kind).toBe('chart')
    if (model.kind !== 'chart') return
    expect(model.designationsWithheld).toBe(true)
  })
})
