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
import { makeData, openStrategicChallenge } from './analysisNewFixtures'
import type { DecisionResultData } from '../../types'

/**
 * ⚠ TWO ARMS ON EVERY CASE BELOW, AND A REVIEWER IS WHY. A ranking can only be
 * WITHHELD if there was one to withhold, so a fixture with no options tests the
 * wrong question entirely — see the option-less case at the foot of this file,
 * which is the licensed sentence the first version of this gate deleted.
 */
const TWO_ARMS = [
  { id: 'opt_segment', label: 'Segment' },
  { id: 'opt_defer', label: 'Status quo' },
] as unknown[]

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
