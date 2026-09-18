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
 * functions `useResultsSectionData.ts:2056/2085/2272` calls, in the same order.
 * A second spelling of "was this option in the analysis" is how the canvas and
 * the panel end up contradicting each other about one run, which is the defect
 * this estate keeps paying for (trap 21).
 *
 * ## ⚠⚠ A CORRECTED PREMISE — THIS HEADER ONCE SAID "ON THE SAME INPUTS", AND
 * THAT WAS FALSE
 *
 * The three functions are shared; the LEFT SIDE OF THE JOIN was not. This hook
 * collected `state.nodes` where `node.type === 'option'` under a comment
 * claiming the join was "exactly as it is in `useResultsSectionData`", which
 * filters on `(n.data as ResultsCanvasNodeData)?.kind === 'option'`
 * (`:2024`). Two different predicates over two different fields, and the store
 * provably populates them differently: `addNode` (`store.ts:3376-3381`) writes
 * `data: { label }` and nothing else, while `addNodeWithEdge` (`:3478`) writes
 * `data: { label, kind: type }`. So a plain-added option carries `type` and no
 * `data.kind`, and a draft-added one carries both. Sharing the functions and
 * diverging on their arguments is the same defect one level down — and it is
 * invisible, because every function name matches.
 *
 * The join now runs through `resolveNodeTypeLiteral` (`canvas/domain/nodes.ts`),
 * the estate's DECLARED single owner of "what kind of element is this node?",
 * whose own header says a second copy in a hook is trap 12. Its chain is
 * `node.type ?? data.kind ?? data.type`, so it is a strict SUPERSET of the
 * predicate this hook used (anything with `node.type === 'option'` still
 * resolves to `'option'` on the first link) and it additionally catches the
 * `data.kind`-only shape the panel sees and this hook did not.
 *
 * ⚠ AND THE RESIDUAL DIVERGENCE IS REPORTED, NOT SILENTLY CLOSED. The panel's
 * `:2024` filter still reads `data.kind` alone, so a plain-added option is in
 * the canvas's option set and not in the panel's. Widening `:2024` would change
 * which nodes become `OptionResult`s across the entire panel — ranking, winner
 * selection, the comparison table — which is a different change with a
 * different blast radius and is out of this lane's scope. What is fixed here is
 * that the canvas asks the DOMAIN OWNER rather than keeping a private second
 * spelling; what remains is one predicate in the panel, named so the next lane
 * can find it.
 */
import { useCanvasStore } from '../store'
import { resolveNodeTypeLiteral } from '../domain/nodes'
import type { ResultsReport } from '../../components/results/types'
import {
  deriveNotAnalysedReason,
  isAnalysedOption,
  runAnalysedAnyOption,
  type OptionLeftOutOfRunReason,
} from '../../components/results/utils/notAnalysedOptions'

/**
 * `null` when this option was in the run (or when the question cannot be
 * asked honestly). An {@link OptionLeftOutOfRunReason} when the run left it
 * out.
 *
 * ## ⭐⭐ THE FOURTH WORLD: THE GRAPH MOVED AFTER THE RUN
 *
 * `results.status` SURVIVES a graph edit. `pushToHistory` (`store.ts:2054`)
 * sets `graphEditedSinceLastRun: true` and `analysisStateReady: false` and
 * never touches `results`. So a run completes on A and B, the user adds C and
 * wires it to a factor, and C arrives here with an intervention edge and no
 * entry — `deriveNotAnalysedReason` answers `not_returned`, and the card said
 * *"The analysis returned no result for this option"* with no action offered.
 * The analysis returned nothing about C **because C did not exist.** The
 * sentence blamed the engine for the user's own edit.
 *
 * `graphEditedSinceLastRun` is therefore read as a GATE on the engine-blaming
 * arm: we may only say the run answered nothing about this option while the
 * graph is the graph the run saw.
 *
 * ⚠ IT GATES `not_returned` ONLY, AND POOLING `no_interventions` IN WOULD BE A
 * WORSE CARD. An option with no intervention edges is not submittable, so
 * "re-run it" is a FUTILE step — the thing `notAnalysedActionLabel` refuses to
 * prescribe — while "say what it changes" is true and actionable whether the
 * option predates the run or not. The two arms fail in opposite directions and
 * each keeps its own.
 *
 * ⚠ IT OVER-FIRES, AND THAT IS THE CHOSEN DIRECTION. The flag is set by ANY
 * hash-changing edit, a node drag included, so an option that genuinely was
 * submitted and unanswered will yield the fourth sentence after an unrelated
 * edit. That costs PRECISION. The alternative costs TRUTH: asserting the run
 * answered nothing about an option it never saw. The fourth sentence is true in
 * both sub-cases; the `not_returned` sentence is false in one. It fails toward
 * saying less, the same direction as the domain guard below.
 *
 * ⛔ THE FLAG IS A GATE, NEVER A FRESHNESS AUTHORITY. `OutputsDock`,
 * `ActionStrip` and `deriveAnalysisDisplayState` each record that this flag
 * "fabricated 'stale'" and route *"are these results current?"* through the
 * composed CEE freshness semantic instead. That ruling stands and is not
 * touched here: this hook answers *"may I say the run considered THIS
 * option?"*, which is a different question with a different producer, and the
 * copy it selects states the local edit rather than a verdict on the run.
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
export function useOptionLeftOutOfRun(optionNodeId: string): OptionLeftOutOfRunReason | null {
  // ⚠ THE SELECTOR CARRIES ITS OWN RETURN ANNOTATION, AND IT IS LOAD-BEARING.
  // Without it TypeScript infers the selector's return type from its bodies and
  // WIDENS the bare `'graph_edited_since_run'` literal to `string`, so zustand's
  // `U` resolves to `string | null` and the outer signature stops being a union
  // of known reasons. Annotating here also makes every branch checked against
  // the vocabulary rather than merely assignable at the call site.
  return useCanvasStore((state): OptionLeftOutOfRunReason | null => {
    if (state.results.status !== 'complete') return null
    const report = state.results.report
    if (!report) return null
    const optionProbabilities =
      (report as unknown as ResultsReport).option_probabilities ?? {}

    // The USER'S GRAPH is the left side of the join, resolved through the
    // DOMAIN OWNER of "what kind of node is this" rather than by a private
    // field read — see the corrected premise in this module's header for what
    // the private read got wrong and what remains divergent in the panel.
    // Collected once and reused for both the domain guard and the reason, so
    // the two cannot disagree about which nodes are options.
    const optionNodeIds: string[] = []
    for (const node of state.nodes) {
      if (resolveNodeTypeLiteral(node) === 'option') optionNodeIds.push(node.id)
    }

    // Asked of a node that is not an option at all, this is not a fact we hold.
    if (!optionNodeIds.includes(optionNodeId)) return null

    if (!runAnalysedAnyOption(optionProbabilities, optionNodeIds)) return null
    if (isAnalysedOption(optionProbabilities, optionNodeId)) return null

    const reason = deriveNotAnalysedReason(optionNodeId, state.edges, optionNodeIds)

    // ⭐⭐ THE FOURTH WORLD, GATED ON THE ONE ARM THAT BLAMES THE ENGINE.
    //
    // `not_returned` is the claim "the run had this option and answered
    // nothing about it". That claim is only ours to make while the graph is
    // the graph the run saw. Once it has moved we cannot tell that from "this
    // option was not there", so the claim is WITHDRAWN and replaced by the one
    // sentence true in both — never widened to `no_interventions`, whose step
    // stays right and whose re-run would be futile. See the docblock above.
    if (reason === 'not_returned' && state.graphEditedSinceLastRun) {
      return 'graph_edited_since_run'
    }

    return reason
  })
}
