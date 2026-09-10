/**
 * ⭐⭐ THE GLANCE EXPLAINED THE VERDICT BY NAMING A LEADER THE RUN WITHHELD.
 *
 * ⚠ MEASURED ON THE DEPLOYED BUILD `73825428`, driving a real guest session —
 * not derived from the tree. The producer's own authority said the claim was
 * withheld:
 *
 *   producer_leader_permission: { permitted: false,
 *                                 withheld_reason: "leader_claim_withheld" }
 *
 * and `analysis-new-glance-verdict-reason` rendered:
 *
 *   "none of the factors we could test changed WHICH OPTION LEADS on its own,
 *    and this result mostly held up under the other changes we tested"
 *
 * while `analysis-new-checks-leader`, three sections below on the same screen,
 * correctly read *"Which option is most likely — not assessed"*, and
 * `analysis-new-checks-meaning-leader` read *"This run returned no comparison
 * verdict, so any ordering you see is unconfirmed"*.
 *
 * One surface, one run, two answers — and the producer told us which is right.
 * `buildAtAGlance` gates the HEADLINE on `leaderDesignationPermitted` and left
 * the REASON ungated: the one field on that block nobody had gated.
 *
 * ⚠ THE GATE IS THE PERMISSION, NEVER THE WORDS, so no case here asserts on the
 * presence of "leads". A vocabulary predicate over producer prose is the class
 * this estate keeps getting wrong (trap 22) and breaks the moment CEE rephrases.
 */
import { describe, expect, it } from 'vitest'
import { buildAnalysisNewViewModel } from '../buildAnalysisNewViewModel'
import { makeData, makeOption, openStrategicChallenge } from './analysisNewFixtures'
import { comparableOptions, deriveDecisionVerdict } from '../../../../lib/decisionVerdict'
import type { DecisionResultData } from '../../types'

/**
 * ⚠ TWO ARMS ON EVERY CASE BELOW, AND A REVIEWER IS WHY. A ranking can only be
 * WITHHELD if there was one to withhold, so a fixture with no options tests the
 * wrong question entirely — see the option-less case at the foot of this file,
 * which is the licensed sentence the first version of this gate deleted.
 */
const TWO_ARMS = [
  makeOption({ id: 'opt_segment', label: 'Segment', winProbability: 0.62 }),
  makeOption({ id: 'opt_defer', label: 'Status quo', winProbability: 0.38 }),
]

const PRODUCER_REASON =
  'none of the factors we could test changed which option leads on its own, and this result mostly held up under the other changes we tested'

/**
 * ⚠ TWO COMPLETE LITERALS, NOT A CONDITIONAL SPREAD. `exactOptionalPropertyTypes`
 * is on: an optional field may be ABSENT or a value, never explicitly
 * `undefined`. Two literals also say the thing plainly — the unanswerable case
 * is the producer having said NOTHING, not having said "undefined".
 */
const recommendationFor = (
  leaderDesignationPermitted: boolean | undefined,
): Partial<DecisionResultData> =>
  leaderDesignationPermitted === undefined
    ? {
        robustnessVerdict: 'moderate',
        robustnessVerdictReason: PRODUCER_REASON,
        allOptions: TWO_ARMS,
      }
    : {
        robustnessVerdict: 'moderate',
        robustnessVerdictReason: PRODUCER_REASON,
        allOptions: TWO_ARMS,
        leaderDesignationPermitted,
        /**
         * ⭐⭐ `leaderId` IS NON-NULL IN BOTH ARMS, ON PURPOSE, AND IT IS THE
         * SHAPE THE DEPLOYED RUN ACTUALLY HAD: `73825428` carried
         * `leading_option_id: "190d5faf"` alongside
         * `producer_leader_permission: { permitted: false }`.
         *
         * `decisionVerdict.ts` states the rule at the field: *"a non-null
         * `leaderId` does NOT license the phrase 'leading option' —
         * `hasLeadingOption` does. Identity and entitlement are different
         * questions."* A fixture with a null leader on the withheld arm would
         * let the gate pass for the WRONG reason — nothing to name — and could
         * never observe the defect, which is a surface naming a leader it can
         * identify but may not speak about.
         *
         * `separation: 'unknown'` and `source: 'none'` are the producer's own
         * withheld shape: *"'unknown' licenses silence, never a denial."*
         */
        verdict: leaderDesignationPermitted
          ? {
              leaderId: 'opt_segment',
              separation: 'clear',
              hasLeadingOption: true,
              gapPp: 22,
              source: 'producer_band',
            }
          : {
              leaderId: 'opt_segment',
              separation: 'unknown',
              hasLeadingOption: false,
              gapPp: null,
              source: 'none',
            },
      }

/**
 * The shared fixture, with the leader entitlement as the ONLY variable —
 * everything else held constant, so a difference between cases can only be the
 * gate and not a shape I invented.
 */
const verdictOf = (leaderDesignationPermitted: boolean | undefined) =>
  buildAnalysisNewViewModel({
    data: makeData({ recommendation: recommendationFor(leaderDesignationPermitted) }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  } as never).atAGlance.verdict

describe('the glance may not explain the verdict by a ranking the run withheld', () => {
  it('withholds the producer reason when the leader claim is not permitted', () => {
    expect(verdictOf(false)?.reason).toBeUndefined()
  })

  /**
   * ⭐ THE FAIL-OPEN CELL. The predicate is three-valued, and an `undefined`
   * that coerces to "permitted" is exactly how this seam has been re-opened
   * before. Absence of an answer is not permission.
   */
  it('withholds it when the authority could not answer at all', () => {
    expect(verdictOf(undefined)?.reason).toBeUndefined()
  })

  /**
   * ⭐ THE OPPOSITE CONTROL, and what makes this a fix rather than a deletion:
   * on an ENTITLED run the producer's sentence renders verbatim and unchanged.
   */
  it('CONTROL: renders the producer sentence VERBATIM when the claim is permitted', () => {
    expect(verdictOf(true)?.reason).toBe(PRODUCER_REASON)
  })

  /**
   * ⭐⭐ THE GRADE IS NOT SUPPRESSED, AND THAT IS THE POINT OF THE SPLIT.
   * `tone`/`label` are a RUN-LEVEL robustness verdict, not a claim about any
   * option — #494 kept "Analysis complete (robust)" for the same reason. A fix
   * that blanked the whole block would be a different, worse change.
   */
  it('CONTROL: the robustness GRADE survives a withheld leader', () => {
    const v = verdictOf(false)
    expect(v).not.toBeNull()
    expect(v?.tone).toBeTruthy()
    expect(v?.label).toBeTruthy()
  })

  /**
   * ⭐⭐ THE HARM THIS GATE MUST NOT CAUSE — and the case the first version of it
   * failed. An OPEN STRATEGIC CHALLENGE has no options and no verdict: there was
   * never a ranking to withhold, so the producer's sentence is about FACTOR
   * SENSITIVITY and is fully licensed. Deleting it is a second harm pointing the
   * opposite way, and two harms cannot share one parameter.
   *
   * Found by PoC Core's review seat, not by my own corpus — which contained no
   * option-less run at all, so it could not observe the class.
   */
  it('⭐ renders the producer sentence on a run that never HAD a ranking', () => {
    const v = buildAnalysisNewViewModel({
      data: openStrategicChallenge(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    } as never).atAGlance.verdict
    expect(v?.reason).toBe(
      'Small changes in supplier lead time change which direction looks better.',
    )
  })

  /**
   * ⭐ THE DISCRIMINATING PAIR FOR "A RANKING EXISTED". Same unanswerable
   * authority, same absent permission — the ONLY difference is whether there
   * were arms to separate. If these two ever agree, the predicate has collapsed
   * back into the permission-only gate that deleted a licensed sentence.
   */
  it('⭐ the SAME unanswerable authority withholds WITH arms and renders WITHOUT them', () => {
    expect(verdictOf(undefined)?.reason).toBeUndefined()
    const noArms = buildAnalysisNewViewModel({
      data: openStrategicChallenge(),
      recommendations: [],
      isPreRun: false,
      isRunning: false,
      isStale: false,
    } as never).atAGlance.verdict
    expect(noArms?.reason).toBeTruthy()
  })
})

// ── THE RETAINED REPORT SURVIVES A GRAPH EDIT; ITS RANKING STAYS WITHHELD ─────

/**
 * ⛔⛔ AN EXPLICITLY WITHHELD RANKING BECAME SPEAKABLE BECAUSE AN OPTION WAS
 * DELETED. Review's schedule, reproduced here through the REAL producers at every
 * hop rather than asserted on a boolean leaf.
 *
 *   1. A completed TWO-option report is retained, carrying its ranking
 *      explanation and `producer_leader_permission: { permitted: false }`.
 *   2. The user deletes one option. `deleteNodeById` updates nodes and edges and
 *      invalidates readiness — it does NOT erase the completed report.
 *   3. `useResultsSectionData` rebuilds `allOptions` from the CURRENT option
 *      nodes and calls `deriveDecisionVerdict` with the visible ids.
 *   4. `decisionVerdict.ts` filters by those ids and returns the NO-CLAIM verdict
 *      at `comparable.length < 2` — BEFORE it reads the producer's permission. So
 *      `leaderId` is null and `hasLeadingOption` is false.
 *   5. The first version of `rankingWasWithheld` read ONLY those two projected
 *      signals, concluded "there was never a ranking", and let the retained
 *      report's ranking explanation render.
 *
 * ⚠⚠ WHY THIS IS NOT A BOOLEAN-LEAF TEST. `deriveDecisionVerdict` and
 * `comparableOptions` are the real imports and the report is a real payload shape,
 * so steps 3 and 4 EXECUTE here. A fixture that hand-set `verdict` and
 * `allOptions` to the post-deletion values would encode my model of the
 * projection rather than the projection, and would keep passing if
 * `decisionVerdict`'s early return ever moved relative to the permission read —
 * which is the exact ordering the defect depends on.
 *
 * ⚠ WHAT IT STILL DOES NOT COVER, stated rather than implied: the React hook
 * itself. `licensesComparativeLeaderClaim(undefined)` is `true` (no admission =>
 * the producer has not spoken), so the hook's `Q1 && Q2` reduces to `Q2`, which is
 * what `leaderDesignationPermitted` is set from below. That composition is
 * reproduced, not executed.
 */
const RETAINED_TWO_OPTION_REPORT = {
  option_probabilities: {
    opt_segment: { win_probability: 0.62 },
    opt_defer: { win_probability: 0.38 },
  },
  producer_leader_permission: { permitted: false, withheld_reason: 'leader_claim_withheld' },
  robustness: { recommended_option_id: 'opt_segment' },
}

/** A run that only ever scored ONE option — the contrast control's report. */
const RETAINED_ONE_OPTION_REPORT = {
  option_probabilities: { opt_segment: { win_probability: 0.62 } },
  robustness: { recommended_option_id: 'opt_segment' },
}

/** The recommendation the hook would publish for a given canvas visibility. */
const recAfterEdit = (
  report: unknown,
  visibleOptionIds: readonly string[],
): Partial<DecisionResultData> => {
  const visible = new Set(visibleOptionIds)
  const verdict = deriveDecisionVerdict(report as never, { visibleOptionIds: visible })
  return {
    robustnessVerdict: 'moderate',
    robustnessVerdictReason: PRODUCER_REASON,
    allOptions: TWO_ARMS.filter(o => visible.has(o.id)),
    // Q1 is absent (no admission => `true`), so the composed field reduces to Q2.
    leaderDesignationPermitted: verdict.hasLeadingOption,
    verdict,
    rankedComparisonPopulation: comparableOptions(report as never).length,
  }
}

const reasonAfterEdit = (report: unknown, visibleOptionIds: readonly string[]) =>
  buildAnalysisNewViewModel({
    data: makeData({ recommendation: recAfterEdit(report, visibleOptionIds) }),
    recommendations: [],
    isPreRun: false,
    isRunning: false,
    isStale: false,
  } as never).atAGlance.verdict?.reason

describe('a retained withheld ranking stays withheld after the graph changes', () => {
  /**
   * ⚠ THE PRECONDITION, PINNED IN-TEST. The three cases below are only about the
   * REPORT-side signal if the PROJECTED signals genuinely collapse — otherwise
   * each would pass for the old reason and observe nothing.
   */
  it('PRECONDITION: deleting an option really does collapse both projected signals', () => {
    const both = recAfterEdit(RETAINED_TWO_OPTION_REPORT, ['opt_segment', 'opt_defer'])
    const one = recAfterEdit(RETAINED_TWO_OPTION_REPORT, ['opt_segment'])

    // With two visible the verdict reaches the permission read and withholds there.
    expect(both.allOptions).toHaveLength(2)
    expect(both.verdict?.leaderId).toBe('opt_segment')

    // With one visible it returns the NO-CLAIM verdict BEFORE reading permission,
    // so both signals the old predicate relied on now say "no ranking existed".
    expect(one.allOptions).toHaveLength(1)
    expect(one.verdict?.leaderId).toBeNull()
    expect(one.verdict?.hasLeadingOption).toBe(false)
  })

  /**
   * ⭐⭐ THE REPORT-SIDE SIGNAL DOES NOT FOLLOW THE CANVAS — the invariant the fix
   * rests on. A report does not un-rank itself when the user tidies the graph.
   */
  it('⭐⭐ the run’s own comparison population is 2 at EVERY visibility', () => {
    for (const visible of [['opt_segment', 'opt_defer'], ['opt_segment'], []]) {
      expect(
        recAfterEdit(RETAINED_TWO_OPTION_REPORT, visible).rankedComparisonPopulation,
        `visibility ${JSON.stringify(visible)}`,
      ).toBe(2)
    }
  })

  it('withholds with BOTH options still visible', () => {
    expect(reasonAfterEdit(RETAINED_TWO_OPTION_REPORT, ['opt_segment', 'opt_defer'])).toBeUndefined()
  })

  /**
   * ⭐⭐ THE CASE THE DEFECT LIVED IN. Without the report-side signal this RENDERS
   * the retained ranking explanation, and it is reachable on an ordinary graph
   * edit rather than an invented fixture.
   */
  it('⭐⭐ STILL withholds after ONE option is deleted', () => {
    expect(reasonAfterEdit(RETAINED_TWO_OPTION_REPORT, ['opt_segment'])).toBeUndefined()
  })

  it('⭐ STILL withholds when every option is gone', () => {
    expect(reasonAfterEdit(RETAINED_TWO_OPTION_REPORT, [])).toBeUndefined()
  })

  /**
   * ⭐⭐ THE CONTRAST CONTROL, AND IT IS WHAT STOPS THE FIX BECOMING "ALWAYS
   * WITHHOLD". A run whose report only ever scored ONE option never had a ranking,
   * so its robustness sentence is not a claim about an ordering and must still
   * render. If this ever goes silent, the report-side term has widened into the
   * permission-only gate that deleted a licensed sentence in the first place.
   */
  it('⭐⭐ CONTROL: a run that only ever scored ONE option still renders its reason', () => {
    const rec = recAfterEdit(RETAINED_ONE_OPTION_REPORT, ['opt_segment'])
    expect(rec.rankedComparisonPopulation).toBe(1)
    expect(reasonAfterEdit(RETAINED_ONE_OPTION_REPORT, ['opt_segment'])).toBe(PRODUCER_REASON)
  })

  /**
   * ⚠ AND ABSENCE IS NOT ZERO. A legacy fixture omitting the field must fall
   * through to the projection signals, not be read as "this run was unranked" —
   * which would silently re-open the original defect for every older consumer.
   * The `exactOptionalPropertyTypes` rule is why the key is OMITTED rather than
   * set to `undefined`.
   */
  it('CONTROL: with the field ABSENT, the projection signals still withhold on two arms', () => {
    expect(verdictOf(false)?.reason).toBeUndefined()
  })
})
