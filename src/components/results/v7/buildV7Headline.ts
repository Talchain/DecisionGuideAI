/**
 * buildV7Headline — pure passthrough for the V7 hero headline (V7 Lane L4).
 *
 * Composes the hero headline + subline from EXISTING results-store data only —
 * never invents a number or a claim (V6-RESPEC-2026-07-23 §L4: "UI IS A
 * PASSTHROUGH"). Every string form below is sourced VERBATIM from a live
 * production headline surface, so "Headline copy matches production strings"
 * (spec row 3 done-when) holds:
 *
 *   · "{winner} performs best"        — M1 winner headline
 *     (src/components/debug/utils/exportBundle.ts `deriveHeroHeadline`;
 *      src/canvas/components/ResultsPanel/OptionComparisonReveal.tsx)
 *   · "{winner} is your only option"  — single-option form
 *     (src/components/results/utils/certaintyCopy.ts rule 3)
 *   · "No clear leading option"       — indeterminate / GAP form
 *     (certaintyCopy.ts rule 1: "no clear leading option, …")
 *   · "Too close to call"             — near-tie form (recommendation.nearTie)
 *   · "Leads by N points" subline (certaintyCopy.ts rule 4)
 *     (the companion "{winner} leads slightly more often" was REMOVED from
 *      both this file and certaintyCopy.ts — ROADMAP 1.223: a denial of a
 *      leading option must not carry a leader claim as its subline)
 *
 * Honest absence: with no recommended option the headline is empty and the
 * hero renders nothing (the caller gates the whole top group on analysis
 * presence). The gauge value is the winner's live win probability, or null.
 */

import type { DecisionResultData, DecisionState } from '../types'
import { GOAL_ANCHOR_COPY, COMPARATIVE_COPY } from '../utils/goalAnchorCopy'
import { formatGoalProbability } from '../utils/displayFloors'
import { goalLeadPoints, selectGoalLeader } from '../utils/selectGoalLeader'
import { formatProbabilityWithResolution } from '../../../utils/formatPercent'

export interface V7HeadlineModel {
  /** Main headline. Empty string when there is no winner to headline. */
  headline: string
  /** One-line subhead, or null when no honest subline applies. */
  subline: string | null
  /** Winner win probability in [0,1] for the gauge, or null when absent. */
  winProbability: number | null
  /** Winner display label, or null. */
  winnerLabel: string | null
}

/**
 * @param recommendation `resultsSectionData.recommendation` (DecisionResultData)
 * @param decisionState  `buildResultsVM(...).decisionState` — the SAME tri-state
 *   the live hero uses ('robust' | 'sensitive' | 'indeterminate').
 */
export function buildV7Headline(
  recommendation: DecisionResultData,
  decisionState: DecisionState,
): V7HeadlineModel {
  const winner = recommendation.recommendedOption ?? null
  const allOptions = recommendation.allOptions ?? []
  const optionCount = allOptions.length
  const winnerLabel = winner?.label ?? null
  const winProbability =
    typeof winner?.winProbability === 'number' && Number.isFinite(winner.winProbability)
      ? winner.winProbability
      : null

  // No winner → nothing to headline (honest absence; caller renders nothing).
  if (!winnerLabel) {
    return { headline: '', subline: null, winProbability, winnerLabel: null }
  }

  // Single option — the honest "only option" form.
  if (optionCount === 1) {
    return {
      headline: `${winnerLabel} is your only option`,
      subline: null,
      winProbability,
      winnerLabel,
    }
  }

  // SINGLE VERDICT (2026-07-25): ONE gate for "is there a leading option?".
  //
  // This block used to hold TWO independent denials — `nearTie.isTie` (the
  // producer's, correct) and `decisionState === 'indeterminate'` (which folds
  // in stability thresholds 0.80/0.55, so a genuinely clear lead was denied
  // for being FRAGILE). That second denial is the same category error the
  // results-panel headline made, and it is removed: fragility is disclosed on
  // its own surfaces, never by pretending the options are tied.
  //
  // The tie call now comes from the shared verdict (src/lib/decisionVerdict.ts),
  // which reads PLoT's own `robustness.near_tie` — so this headline, the
  // results-panel headline, the canvas badge, the analysis hero, the inspector
  // and the checks footer all quote one answer. Absent verdict (older
  // fixtures) keeps the historic producer-near-tie behaviour.
  // ROADMAP 1.223: gate on `hasLeadingOption` (the ENTITLEMENT), not on
  // `separation === 'tied'` (one particular REASON there is no leader).
  // Those differ exactly on `'unknown'` — which is now what a withheld turn
  // produces — and on the old gate `'unknown'` fell straight through to
  // "{winner} performs best".
  const verdict = recommendation.verdict
  const noLeadingOption = verdict
    ? !verdict.hasLeadingOption
    // No verdict (older fixtures / callers): byte-identical legacy behaviour,
    // both denials intact. The live path always carries one.
    : (recommendation.nearTie?.isTie === true || decisionState === 'indeterminate')
  if (noLeadingOption) {
    // Only a POSITIVE tie call licenses denying a leader. `'unknown'` — the
    // producer withheld the claim, or sent none — licenses silence: the hero
    // renders nothing rather than asserting the options are close.
    if (verdict && verdict.separation === 'unknown') {
      return { headline: '', subline: null, winProbability, winnerLabel }
    }
    return {
      // "Too close to call" is reserved for the producer's own explicit tie
      // flag; the shared verdict's other tied paths use the plainer form.
      headline: recommendation.nearTie?.isTie === true ? 'Too close to call' : 'No clear leading option',
      // The subline used to read "{winner} leads slightly more often" — a
      // leader claim printed directly beneath "No clear leading option", and
      // the exact contradictory pair `decisionVerdict`'s own header cites as
      // the original defect. The headline was fixed then; the subline was
      // not. It is dropped: a denial does not get a leader for a companion.
      subline: null,
      winProbability,
      winnerLabel,
    }
  }

  /**
   * ⭐ THE GOAL CROWN (ROADMAP 2.233). This used to read the goal probability
   * off `winner` — the COMPARATIVE leader — and print "has the highest chance
   * of hitting your goal" without ever consulting a rival. The superlative was
   * unearned by construction: A(win .70, goal .40) beside B(win .30, goal .80)
   * crowned A at 40% while the goal block on the same screen ranked B first at
   * 80%. Headline identity, headline number and subline gap came from two
   * different questions.
   *
   * The entitlement now comes from `selectGoalLeader` — the rule
   * `buildHeroModel` (UI-SEM-072) already held and which the hero now shares,
   * so the two surfaces cannot disagree about who leads on the goal view. It
   * returns null rather than a wrong crown whenever the claim is not earned
   * (designations withheld, no user target, an unmeasured rival, a tie at the
   * top, or nothing clearing the sub-1% floor), and the headline then falls
   * through to the honest COMPARATIVE arm below — the hero's own fallback.
   *
   * ONE SUBJECT, ONE METRIC. When the crown lands, every field of this model
   * describes the CROWNED option: `V7Hero` paints `winProbability` into a
   * gauge immediately beside the headline, so carrying the comparative
   * leader's number under the goal leader's name would recreate the defect one
   * element to the left. The subline likewise measures the GOAL gap, not the
   * comparative one.
   */
  const goalLeader = selectGoalLeader(allOptions, (o) => o.goalProbability, {
    // Always false by this point — the `noLeadingOption` gate above returns
    // early on a withheld verdict. Passed explicitly anyway: the entitlement
    // belongs to the selector, so a future change to that gate cannot silently
    // re-open the crown.
    designationsWithheld: verdict != null && !verdict.hasLeadingOption,
    hasUserTarget: recommendation.goalThreshold != null,
  })

  if (goalLeader && goalLeader.label) {
    const leadPoints = goalLeadPoints(allOptions, (o) => o.goalProbability, goalLeader)
    return {
      headline: GOAL_ANCHOR_COPY.headline(
        goalLeader.label,
        // UI-SEM-057: the shared floor, so a 1.2% goal probability reads the
        // same here as on the option card beside it. ROADMAP 2.334 adds the
        // leader's own sample count, so the headline resolves a sub-1% figure
        // exactly as the card and the goal lens now do — a headline saying
        // "< 1%" over rows saying "0.1%" would be the same contradiction one
        // element up.
        formatGoalProbability(goalLeader.goalProbability as number, goalLeader.nValidSamples),
        goalLeader.goalFitIsSubstitutedJoint === true,
      ),
      subline: leadSubline(leadPoints),
      winProbability:
        typeof goalLeader.winProbability === 'number' && Number.isFinite(goalLeader.winProbability)
          ? goalLeader.winProbability
          : null,
      winnerLabel: goalLeader.label,
    }
  }

  /**
   * The COMPARATIVE arm — the analysis leader, named by the quantity that
   * actually ranks it.
   *
   * ⭐ RE-ANCHORED 2026-07-31 (§6.2c, RETIRE). Was `"{winner} performs best"`
   * — the closest sentence in the product to "choose this": an unqualified
   * superlative with no stated basis, no number and no timeframe, which a
   * reader cannot argue with because it drops the figure that would let them.
   *
   * Subline names the lead in points when the runner-up carries a win
   * probability we can difference against (store-derived, never fabricated).
   * Same metric as the headline above it, same subject.
   */
  const runnerUp = allOptions
    .filter(o => o.id !== winner?.id)
    .filter((o): o is typeof o & { winProbability: number } => typeof o.winProbability === 'number')
    .sort((a, b) => b.winProbability - a.winProbability)[0]
  const gapPoints =
    winProbability != null && runnerUp
      ? Math.round((winProbability - runnerUp.winProbability) * 100)
      : null

  const headline =
    winProbability != null
      // ROADMAP 2.236: the shared FLOORED comparative formatter, not a bare
      // `formatPercent`. Same rule as the option card and the canvas node, so
      // this sentence cannot say "came out ahead in 0% of simulated scenarios"
      // about a measured non-zero probability while they say "< 1%".
      ? `${winnerLabel} ${COMPARATIVE_COPY.clause(formatProbabilityWithResolution(winProbability, null))}`
      : `${winnerLabel} — ${COMPARATIVE_COPY.unavailableClause}`

  return {
    headline,
    subline: leadSubline(gapPoints),
    winProbability,
    winnerLabel,
  }
}

/**
 * The shipped lead-in-points subline (certaintyCopy.ts rule 4), built in ONE
 * place so the goal arm and the comparative arm cannot render the same claim
 * with different pluralisation. A non-positive or absent gap yields no
 * subline — silence rather than "Leads by 0 points".
 */
function leadSubline(points: number | null): string | null {
  if (points == null || points <= 0) return null
  return `Leads by ${points} point${points === 1 ? '' : 's'}`
}
