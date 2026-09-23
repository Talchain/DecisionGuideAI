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
 *      not merely out of date — it names the wrong factor. (⚠ AMENDED 23 Sep:
 *      OR the model is KNOWN to have changed, in which case the readout is
 *      returned marked `fromLastRun` for its reader to label — see below.)
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
 *
 * ## ⭐⭐ 23 SEP 2026 — CONDITION 2 IS NOW "CURRENT, OR KNOWN TO HAVE CHANGED".
 *
 * Paul accepted Q2, 22 Sep: keep the figure and the rank, labelled
 * 'Last run ·' when the model has changed. His Ruling 3 (ROADMAP 2.651) is the
 * same instruction one level up: "out-of-date results are labelled, not
 * withheld". So the stale arm is SPLIT by what the composed verdict knows:
 *
 *   · current                → the readout, `fromLastRun: false`;
 *   · 'changed'              → the SAME readout, `fromLastRun: true`. Every
 *                              reader prefixes `LAST_RUN_PREFIX` off the same
 *                              predicate (`useModelChangedSinceRun`), so the
 *                              rank is spoken as a claim ABOUT THAT RUN — which
 *                              answers the wrong-factor argument above rather
 *                              than ignoring it;
 *   · cannot_confirm / never → `null`, unchanged. "Last run" there would be a
 *                              claim the state does not support.
 *
 * ⚠ `fromLastRun` IS CARRIED ON THE READOUT so a consumer that must NOT speak
 * about a stale run — the card's top-influence coaching chip, which asks the
 * user to act on the rank — can refuse it without a second freshness read.
 */
import { useMemo } from 'react'
import { useAnalysisResultsAreCurrent } from './useAnalysisResultsAreCurrent'
import { useModelChangedSinceRun } from './useModelChangedSinceRun'
import {
  influenceRankReadout,
  type InfluenceRankReadout,
} from '../../components/results/influenceScaleCopy'

/** The licensed readout, and whether it describes the run BEFORE the latest edit. */
export interface ScopedInfluenceRank extends InfluenceRankReadout {
  /** True exactly when `useModelChangedSinceRun()` — the caller labels it "Last run". */
  fromLastRun: boolean
}

export function useInfluenceRank(
  sensitivityRank: number | null | undefined,
  influenceSetSize: number | null | undefined,
): ScopedInfluenceRank | null {
  const resultsAreCurrent = useAnalysisResultsAreCurrent()
  const modelChangedSinceRun = useModelChangedSinceRun()
  return useMemo(() => {
    if (!resultsAreCurrent && !modelChangedSinceRun) return null
    const readout = influenceRankReadout(sensitivityRank, influenceSetSize)
    return readout ? { ...readout, fromLastRun: modelChangedSinceRun } : null
  }, [resultsAreCurrent, modelChangedSinceRun, sensitivityRank, influenceSetSize])
}
