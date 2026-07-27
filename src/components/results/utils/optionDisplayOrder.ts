/**
 * Shared presentation order for option surfaces.
 *
 * OptionCards (V14.2, same order as WinGauge segments) and the analysis
 * hero must number and order options identically — the staging trust
 * review found the hero ranking rows by expected value while the cards
 * below ranked by win probability, so one screen showed the same option
 * as #1 and #4 simultaneously.
 *
 * Rule (extracted verbatim from OptionCards): win probability descending
 * when EVERY option carries one — mixed coverage would treat missing
 * values as 0 and fabricate rankings — otherwise expected value
 * (falling back to goalProbability) descending. Array.prototype.sort is
 * stable, so ties keep the caller's presentation order (deterministic
 * with allOptions[] input). Selection/ordering of existing producer
 * values only — no new values are computed.
 *
 * ## ORDER IS A DESIGNATION (ROADMAP 1.267)
 *
 * Ruled 27 Jul, ratified as Codex decision (1) in ROADMAP row 1.306:
 * probability-descending order is not a neutral presentation choice, it is a
 * CLAIM about which option is first — "position-as-designation", the same
 * defect CEE PR #719 fixed on the producer side by canonicalising
 * `decision_brief.options[]`. On a run whose verdict WITHHOLDS, the honest
 * order is the CANONICAL one (the caller's own array, which on the live path
 * is graph/creation order from `nodes.filter(kind === 'option')`), and the
 * probabilities keep rendering unchanged because the DATA is not withheld —
 * only the CLAIM.
 *
 * This corrects a documented assumption. `OptionCardsProps.hasLeadingOption`
 * used to say `winnerId` "still drives segment colours, the lens crown and
 * card ordering, none of which claim anything"; row 1.306 records the
 * confirming screenshots and names it directly — "the G-UI-1 closure treated
 * client-side ordering as benign when it is the designation channel".
 *
 * ## Why the second parameter is REQUIRED
 *
 * Every option list on the results path funnels through this function, so it
 * is the one place the order designation is authored — and a hand-maintained
 * list of "call sites that remembered to gate" is exactly the mirror defect
 * that drifts silently (CLAUDE.md trap 12). Making the answer mandatory means
 * a new call site cannot inherit the designation by forgetting: omitting it
 * is a TYPE ERROR, not a silent regression. Same move `decisionVerdict` made
 * by deleting `'win_probability'` from its `source` union.
 */
import type { OptionResult } from '../types'

type DisplayOrderFields = Pick<OptionResult, 'winProbability' | 'expected' | 'goalProbability'>

export interface DisplayOrderOptions {
  /**
   * True when the run's verdict withholds the leader claim — i.e.
   * `DecisionVerdict.hasLeadingOption === false`, the single boolean
   * `src/lib/decisionVerdict.ts` documents as the one every surface gates on.
   *
   * Callers RENDER this decision, they never re-derive it: each call site
   * reads the verdict it already holds. A caller with no verdict at all
   * (legacy fixtures predating the shared verdict) passes `false` and keeps
   * byte-identical legacy behaviour — absence of a signal is not a withheld
   * claim, and the one live path always supplies one.
   */
  designationsWithheld: boolean
}

export function sortOptionsForDisplay<T extends DisplayOrderFields>(
  options: readonly T[],
  { designationsWithheld }: DisplayOrderOptions,
): T[] {
  // WITHHELD: no comparator runs at all. Returning the caller's own order
  // (rather than sorting by some other key) is the point — any sort this
  // module could apply would be a second designation wearing a different
  // number. The copy keeps callers free to mutate the result as before.
  if (designationsWithheld) return [...options]

  // Number.isFinite (not `!= null`): a NaN winProbability would pass the
  // null check, poison the comparator (NaN ?? 0 stays NaN), and make the
  // order arbitrary — mixed/invalid coverage must fall back to expected.
  const allHaveWinProb =
    options.length > 0 && options.every(o => typeof o.winProbability === 'number' && Number.isFinite(o.winProbability))
  return [...options].sort((a, b) => {
    if (allHaveWinProb) return (b.winProbability ?? 0) - (a.winProbability ?? 0)
    return (b.expected ?? b.goalProbability ?? -Infinity) - (a.expected ?? a.goalProbability ?? -Infinity)
  })
}
