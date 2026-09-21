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
import {
  influenceRankReadout,
  type InfluenceRankReadout,
} from '../../components/results/influenceScaleCopy'

export function useInfluenceRank(
  sensitivityRank: number | null | undefined,
  influenceSetSize: number | null | undefined,
): InfluenceRankReadout | null {
  const resultsAreCurrent = useAnalysisResultsAreCurrent()
  return resultsAreCurrent ? influenceRankReadout(sensitivityRank, influenceSetSize) : null
}
