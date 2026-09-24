/**
 * `useInfluenceRank` — MAY THIS CARD NAME THE FACTOR'S RANK, AND WHAT IS IT?
 *
 * ⭐⭐ IT EXISTS BECAUSE A SECOND SURFACE NOW NEEDS THE SAME ANSWER, AND THE
 * ANSWER IS TWO CONDITIONS, NOT ONE.
 *
 * A rank may be spoken only when BOTH hold:
 *
 *   1. `influenceRankReadout` licenses it — an integer rank inside a set of at
 *      least two, with the rank no larger than the set. That guard is the
 *      owner's and is not restated here.
 *   2. `useAnalysisResultsAreCurrent` says the run is about the graph in front
 *      of the reader. A rank is a comparison ACROSS factors, so a stale one is
 *      not merely out of date — it names the wrong factor.
 *
 * `FactorNode` has carried both since the ranked readout shipped. The reduced
 * line — the whole card below the legibility floor — carried NEITHER, and so
 * always fell through to the bare percentage. Copying the pair into a second
 * component would be this estate's signature defect (CLAUDE.md trap 12: a
 * hand-maintained mirror, and it always reads green while it drifts), which is
 * why the pair moved here rather than being spelled twice.
 *
 * ⛔ THE PERCENTAGE IS NOT THE FALLBACK'S FAULT. `Influence 62%` is a
 * LICENSED rendering where no rank is available — `FactorNode` shows it too,
 * from the same branch. What was wrong was showing it where a rank WAS
 * available, so one number carried two different claims at two zoom levels.
 */
import { useAnalysisResultsAreCurrent } from './useAnalysisResultsAreCurrent'
import { useRunCurrency } from '../nodes/shared/runCurrency'
import {
  influenceRankReadout,
  type InfluenceRankReadout,
} from '../../components/results/influenceScaleCopy'

export function useInfluenceRank(
  sensitivityRank: number | null | undefined,
  influenceSetSize: number | null | undefined,
): InfluenceRankReadout | null {
  // ⛔ Composed verdict AND local: the local-only hook lets a wire `refused` /
  // `unknown_degraded` through over fresh fields, and then the reduced line named
  // a rank the full card withholds (reviewer blocker on Paul 23 Sep contract
  // feedback points 11/14; the card's rule is Codex #63 5801431996).
  const locallyCurrent = useAnalysisResultsAreCurrent()
  const resultsAreCurrent = useRunCurrency() === 'current' && locallyCurrent
  return resultsAreCurrent ? influenceRankReadout(sensitivityRank, influenceSetSize) : null
}

/**
 * ⭐ THE DRIVER RANK A FACTOR'S RUN-DERIVED CUES MAY STATE (Canvas design
 * integration, 23 Sep 2026) — one rule for the card's `FactorDriverLine` and
 * its reduced line, so the two rungs cannot disagree.
 *
 *   · the run is CURRENT → the rank `useInfluenceRank` already licensed;
 *   · the model is KNOWN to have changed since the run
 *     (`useModelChangedSinceRun`) → the SAME readout's structural guard, and
 *     the caller prefixes `LAST_RUN_PREFIX` — Paul's Ruling 3 (ROADMAP 2.651,
 *     "labelled, not withheld") as #1891 applied it to the retired `Key driver`
 *     badge, and visual contract v3 ("Last run · Driver N of M");
 *   · never-run / cannot-confirm → null. No past analysis is invented
 *     (ED 02:31Z, Q2).
 *
 * `useInfluenceRank` itself is UNCHANGED: its `null` still means "not
 * confirmably current", which is what its other readers ask.
 *
 * ⭐ ED #63 5806207128 (24 Sep): the returned `setSize` is the PRINTED `M` —
 * the ELIGIBLE ANALYSED factors (`influenceSetSize`, the same licence set
 * `influenceRankReadout` checks), "not 'number of ranks we happen to render'".
 * That restores the served M and retires contract v3.1 pt 5's ranked-count
 * denominator. The ranked count (`influenceRankedCount`) stays as the
 * fail-closed PUBLICATION guard only: a rank outside it, or an absent count,
 * states no rank.
 */
export function driverRankFor(
  currentReadout: InfluenceRankReadout | null,
  sensitivityRank: number | null | undefined,
  influenceSetSize: number | null | undefined,
  fromLastRun: boolean,
  rankedCount: number | null | undefined,
): { rank: number; setSize: number } | null {
  const licensed =
    currentReadout !== null ||
    (fromLastRun && influenceRankReadout(sensitivityRank, influenceSetSize) !== null)
  return licensed &&
    typeof sensitivityRank === 'number' &&
    typeof influenceSetSize === 'number' &&
    typeof rankedCount === 'number' &&
    Number.isInteger(rankedCount) &&
    sensitivityRank <= rankedCount
    ? { rank: sensitivityRank, setSize: influenceSetSize }
    : null
}
