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
 *   · "{winner} leads slightly more often" / " by N points" sublines
 *     (certaintyCopy.ts rules 1 and 4)
 *
 * Honest absence: with no recommended option the headline is empty and the
 * hero renders nothing (the caller gates the whole top group on analysis
 * presence). The gauge value is the winner's live win probability, or null.
 */

import type { DecisionResultData, DecisionState } from '../types'

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
  const verdict = recommendation.verdict
  const noLeadingOption = verdict
    ? verdict.separation === 'tied'
    : recommendation.nearTie?.isTie === true
  if (noLeadingOption) {
    return {
      // "Too close to call" is reserved for the producer's own explicit tie
      // flag; the shared verdict's other tied paths use the plainer form.
      headline: recommendation.nearTie?.isTie === true ? 'Too close to call' : 'No clear leading option',
      subline: `${winnerLabel} leads slightly more often`,
      winProbability,
      winnerLabel,
    }
  }

  // Clear winner — "performs best". Subline names the lead in points when the
  // runner-up carries a win probability we can difference against (store-derived,
  // never fabricated).
  const runnerUp = allOptions
    .filter(o => o.id !== winner?.id)
    .filter((o): o is typeof o & { winProbability: number } => typeof o.winProbability === 'number')
    .sort((a, b) => b.winProbability - a.winProbability)[0]
  const gapPoints =
    winProbability != null && runnerUp
      ? Math.round((winProbability - runnerUp.winProbability) * 100)
      : null
  const subline =
    gapPoints != null && gapPoints > 0
      ? `Leads by ${gapPoints} point${gapPoints === 1 ? '' : 's'}`
      : null

  return {
    headline: `${winnerLabel} performs best`,
    subline,
    winProbability,
    winnerLabel,
  }
}
