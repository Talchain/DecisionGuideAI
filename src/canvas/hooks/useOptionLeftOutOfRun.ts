/**
 * `useOptionLeftOutOfRun` — DID THE RUN LEAVE THIS OPTION OUT ALTOGETHER?
 *
 * ## The fourth absence, and why the node card did not have it
 *
 * The ratified design draws four absences apart because each has a DIFFERENT
 * next step. Measured at this tip, the canvas option card already draws three:
 *
 *   · NOT ESTIMATED — nobody set a number (`METRIC_UNSET`, on the graph).
 *   · NOT IN THIS ANALYSIS — CEE predicts the NEXT run will hold this option
 *     out (`excluded-from-analysis-pill`, read from readiness
 *     `waived_by_exclusion`). A claim about a run that has not happened.
 *   · NOT COMPUTED — the run RAN on this option and ISL returned no usable
 *     result (`option-not-computed-*`, `option_probabilities[id].status`).
 *
 * The fourth — **the run that HAS happened left this option out, so there is
 * no entry for it at all** — had no node-card rendering. It fell through to
 * `option-result-unavailable-*`, *"On the data so far, no support percentage
 * for this option"*, which is TRUE and pools two states with opposite next
 * steps: an option the engine scored and could not resolve a share for (wait,
 * or re-run) and an option the engine never scored (say what it changes). A
 * reader who cannot tell those apart takes the wrong action or none.
 *
 * The results panel has drawn this line since the no-rank ruling
 * (`NotAnalysedOptionCard`, Paul, 14 Aug 2026). This hook is what lets the
 * CANVAS draw the same one, from the same predicates and the same copy — never
 * a second spelling of either.
 *
 * ## ⚠ WHY THIS IS ITS OWN MODULE AND NOT ANOTHER EXPORT ON
 * `useNodeDisplayMetadata`
 *
 * 57 spec files mock that module with a hand-listed `vi.mock` factory, and a
 * factory REPLACES the module — so every new export added there is silently
 * absent in all 57 and they fail at render with "No export is defined on the
 * mock". That is CLAUDE.md trap 12 (the hand-maintained mirror) with 57
 * copies; `useSupportShareRunWideAbsent` was split out of that module for
 * exactly this reason and measured 289 tests red when it was not. This follows
 * it rather than re-learning it.
 *
 * ## ⛔ NOTHING HERE IS A NEW AUTHORITY
 *
 * `isAnalysedOption`, `runAnalysedAnyOption` and `deriveNotAnalysedReason` are
 * imported from `components/results/utils/notAnalysedOptions` — the same three
 * functions `useResultsSectionData.ts:2056/2085/2272` calls, in the same order,
 * on the same inputs. A second spelling of "was this option in the analysis"
 * is how the canvas and the panel end up contradicting each other about one
 * run, which is the defect this estate keeps paying for (trap 21).
 */
import { useCanvasStore } from '../store'
import type { ResultsReport } from '../../components/results/types'
import {
  deriveNotAnalysedReason,
  isAnalysedOption,
  runAnalysedAnyOption,
  type NotAnalysedReason,
} from '../../components/results/utils/notAnalysedOptions'

/**
 * `null` when this option was in the run (or when the question cannot be
 * asked honestly). A {@link NotAnalysedReason} when the run left it out.
 *
 * ## THE DOMAIN GUARD IS THE LOAD-BEARING HALF, and it is not ours
 *
 * "No entry for this option" is true in three worlds and only one is this
 * ruling's: the run left THIS option out; the run produced no per-option
 * output at all; the result ids do not match the graph ids at all. In the
 * second and third EVERY option reads missing, and marking them all would tell
 * a user who configured everything correctly that they configured nothing.
 * `runAnalysedAnyOption` is that guard — *"absent from a result set that HAS
 * results"*, never *"absent"*.
 *
 * ⚠ AND IT IS WHAT MAKES THIS SAFE UNDER THE V5 MAPPER'S SECOND KEYING PATH.
 * `mapV5AnalysisToReport.ts` path B keys `option_probabilities` by
 * `block.win_probabilities` keys VERBATIM — human LABELS on real staging
 * payloads — so the map is full of finite numbers while EVERY canvas node-id
 * lookup misses. Resolved through node ids exactly as the card is, that run
 * reads "no option has an entry", the guard refuses, and no card is marked.
 * It fails toward saying less, which is the direction that cannot lie.
 *
 * ## Mutual exclusion with the two siblings, by construction
 *
 * · NOT COMPUTED gates on `option_probabilities[id].status === 'failed'`,
 *   which REQUIRES an entry. An option with an entry is analysed, so this
 *   returns `null` for it. The two can never both render.
 * · NOT IN THIS ANALYSIS is CEE's prediction about the next run, read off
 *   readiness. Different producer, different tense, different question — named
 *   apart rather than reconciled (trap 21). Both may be true at once and each
 *   states only its own fact.
 *
 * Returns a primitive, so the zustand selector is reference-stable and this
 * adds no re-render beyond an actual change of the answer.
 */
export function useOptionLeftOutOfRun(optionNodeId: string): NotAnalysedReason | null {
  return useCanvasStore((state) => {
    if (state.results.status !== 'complete') return null
    const report = state.results.report
    if (!report) return null
    const optionProbabilities =
      (report as unknown as ResultsReport).option_probabilities ?? {}

    // The USER'S GRAPH is the left side of the join, exactly as it is in
    // `useResultsSectionData`. Collected once and reused for both the domain
    // guard and the reason, so the two cannot disagree about which nodes are
    // options.
    const optionNodeIds: string[] = []
    for (const node of state.nodes) {
      if (node.type === 'option') optionNodeIds.push(node.id)
    }

    // Asked of a node that is not an option at all, this is not a fact we hold.
    if (!optionNodeIds.includes(optionNodeId)) return null

    if (!runAnalysedAnyOption(optionProbabilities, optionNodeIds)) return null
    if (isAnalysedOption(optionProbabilities, optionNodeId)) return null

    return deriveNotAnalysedReason(optionNodeId, state.edges, optionNodeIds)
  })
}
