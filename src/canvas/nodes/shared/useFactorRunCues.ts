import { useMemo } from 'react'
import { useCanvasStore } from '../../store'
import { driverRankFor, useInfluenceRank } from '../../hooks/useInfluenceRank'
import type { NodeDisplayMetadata } from '../../hooks/useNodeDisplayMetadata'
import { useRunCurrency, type RunCurrency } from './runCurrency'
import { selectFactorTurningPointState, type FactorTurningPointState } from './factorTurningPoint'

/**
 * ⭐ A FACTOR'S RUN-DERIVED CUES — ONE DERIVATION FOR THE CARD AND THE INSPECTOR.
 *
 * Moved here unchanged from `FactorNode` (DL ruling #70 5849644637, 26 Sep:
 * "No turning point in this run" moves off the card into the inspector). The
 * inspector must show that line for exactly the factors the card showed it
 * for — a RANKED factor whose run attested no flip — so it has to read the
 * SAME rank licence, not a second spelling of it that could drift.
 *
 *   · `driverLine` — "Driver N of M ranked in this run" + its bar, ONLY for a
 *     factor the run RANKED (`driverRankFor` is the one rank rule; M = the
 *     ranked count), the bar being its relative sensitivity (rank 1 = 1);
 *   · `driverNotRanked` — a run whose cues may be shown did not rank it;
 *   · `turningPointState` — the run's `found` row or its "none" fallback;
 *     never-run / cannot-confirm stay null, so no past run is invented;
 *   · `resultsFromLastRun` — the model is KNOWN to have changed since the run
 *     (`Last run · ` label), `runCuesShown` — current or known-changed.
 * The rules and their citations are unchanged; see `FactorNode`'s docblocks.
 */
export interface FactorRunCues {
  influenceRank: ReturnType<typeof useInfluenceRank>
  runCurrency: RunCurrency
  resultsFromLastRun: boolean
  runCuesShown: boolean
  driverLine: {
    rank: { rank: number; setSize: number }
    /** Relative sensitivity, 0..1, rank 1 = 1 (`rankFactor.relativeSensitivity`); null → no bar. */
    value: number | null
  } | null
  driverNotRanked: boolean
  turningPointState: FactorTurningPointState | null
}

export function useFactorRunCues(nodeId: string, displayMetadata: NodeDisplayMetadata): FactorRunCues {
  // `?.` as the inspector panels read it: a panel can mount over a store with no
  // results slice yet (`FactorExternalPanel.priorRangeHonesty.spec.tsx` seeds one).
  const isPostAnalysis = useCanvasStore(state => state.results?.status) === 'complete'
  const resultsReport = useCanvasStore(state => state.results?.report)
  // ⬇ Moved VERBATIM from `FactorNode` with the derivation it documents.
  /**
   * ⭐ THE RANKED READING OF THE SAME NUMBER — derived ONCE and consumed by
   * every driver render on this card. (Historical: it fed the Standard-view
   * `NodeMetricRow` and the Detailed-view `DataBar`; since the locked design of
   * 23 Sep 2026 both are ONE `FactorDriverLine`, "Driver N of M ranked in this run".) They show the same figure, so they carry the
   * same misread, and fixing one would have left `Relative influence … 100%`
   * reachable one view away — four presentations of one idea, which is the
   * inconsistency this card's rows were unified to remove.
   *
   * `null` whenever the claim is not licensed (see `influenceRankReadout`):
   * both call sites then render EXACTLY what they render today.
   *
   * ## ⭐⭐ AND THE COUNTABLE HALF IS WITHHELD UNLESS THE RESULT IS CONFIRMABLY
   * ABOUT THIS GRAPH — HERE, NOT AT THE PRODUCER.
   *
   * `of 5` is a COUNTABLE claim. Every other readout on this card carries
   * staleness softly — once the graph moves, `80%` is wrong but unfalsifiable
   * from the screen. A denominator is not: run over five factors, add three, and
   * the canvas shows EIGHT factor cards beside a row still claiming `of 5`. The
   * reader refutes the product by counting, which is a different and much more
   * expensive kind of wrong.
   *
   * ⛔ IT WAS GATED IN `useNodeDisplayMetadata` ON `graphEditedSinceLastRun`,
   * AND BOTH HALVES OF THAT WERE WRONG.
   *
   * THE FLAG: `resultsLoadHistorical` (`store.ts:6026`) and
   * `resultsHydrateFromSupabase` (`:6097`) reset it to `false` in the SAME
   * `set()` that writes `results.status: 'complete'`, so restoring a historical
   * run re-published the denominator against a graph it was never computed on —
   * exactly the harm the gate was written to prevent. It also over-fires the
   * other way: `historyHash` (`:2025`) includes `position`, so a node DRAG — which
   * changes no factor the run saw — dropped the caption. The gate is now
   * {@link useAnalysisResultsAreCurrent}, whose header carries the measurement
   * and the reason `analysisFreshnessDirty` is not the remedy either.
   *
   * THE PLACE: gating inside the producer made the assignment CONDITIONAL, which
   * falsified the invariant that makes `influenceSetSize?` safe to leave optional
   * — "rank present, denominator absent is unreachable from this producer". The
   * commit that introduced the gate asserted that invariant in a docblock and
   * DISPROVED it four tests later in the same spec file, where a gated fixture
   * returns `sensitivityRank: 1` with `influenceSetSize: null`. Reading the gate
   * HERE restores the implication at the producer — the assignment is once more
   * unconditional inside the factor branch and runs before the rank gate — so the
   * optionality is safe for the reason its docblock states, with no mock churn
   * and no required-field change. The claim and the licence to make it are two
   * questions, and they now live in two places (CLAUDE.md trap 21).
   *
   * ⚠ ONE GATE, ONE LOCAL, NO DIVERGENCE. Both influence renders read this
   * `influenceRank`, and both `influenceRankExplanation` calls read it too, so
   * the two views cannot disagree about whether the denominator is licensed.
   *
   * ⚠ THE RANK ITSELF IS UNTOUCHED, deliberately and narrowly. `sensitivityRank`
   * is read by the `#N` badge, the inspector and the edge label; withdrawing it
   * would change three surfaces this lane never argued for. What is withheld is
   * only the half a reader can refute by counting.
   */
  /**
   * ⭐ THE PAIR MOVED TO ITS OWN OWNER, unchanged. The reduced line needs the
   * identical answer and had neither half of it; a second spelling here would
   * be the mirror that always reads green while it drifts.
   */
  const influenceRank = useInfluenceRank(displayMetadata.sensitivityRank, displayMetadata.influenceSetSize)
  const runCurrency = useRunCurrency()
  const resultsFromLastRun = runCurrency === 'changed'
  const runCuesShown = runCurrency === 'current' || resultsFromLastRun
  const driverRank =
    isPostAnalysis && runCuesShown
      ? driverRankFor(
          influenceRank,
          displayMetadata.sensitivityRank,
          displayMetadata.influenceSetSize,
          resultsFromLastRun,
          displayMetadata.influenceRankedCount,
        )
      : null
  // ⭐ THE BAR IS THE RANK'S OWN QUANTITY (side-by-side DIFF item 4, 27 Sep
  // 2026). It was `displayMetadata.influence` — `influence_score` over the max of
  // ALL factors — so on Paul's MRR run Driver 1 drew 81% "of the strongest
  // factor", the strongest being `pro_plan_price`, which this card calls
  // unranked. It is now relative sensitivity over rank 1 (contract `driver()`:
  // rank 1 = 100). The LINE is gated on the rank licence alone (`driverRankFor`),
  // no longer also on the influence figure, so every factor counted in M shows
  // its rank (item 3); with no finite figure the line keeps its rank and draws
  // no bar. (`rankFactor` sets the figure exactly when it sets the rank.) The
  // influence figure itself is unchanged and stays in the inspector.
  const relativeSensitivity = displayMetadata.driverRelativeSensitivity
  const driverLine =
    driverRank !== null
      ? {
          rank: driverRank,
          value: typeof relativeSensitivity === 'number' && Number.isFinite(relativeSensitivity) ? relativeSensitivity : null,
        }
      : null
  const driverNotRanked = isPostAnalysis && runCuesShown && driverRank === null
  const turningPointState = useMemo(
    () => (isPostAnalysis && runCuesShown ? selectFactorTurningPointState(resultsReport, nodeId) : null),
    [isPostAnalysis, runCuesShown, resultsReport, nodeId],
  )
  return { influenceRank, runCurrency, resultsFromLastRun, runCuesShown, driverLine, driverNotRanked, turningPointState }
}
