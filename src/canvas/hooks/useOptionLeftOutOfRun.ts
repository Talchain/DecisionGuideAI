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
 * provably populates them differently: `addNode` (`store.ts:3377-3381`) writes
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
 * ⚠⚠ AND THE SCOPE CLAIM THAT USED TO SIT HERE WAS FALSE. It said the residual
 * divergence was "one predicate in the panel". Measured: **six residual
 * predicate sites in three spellings**, and one of them is read in the SAME JSX
 * CONJUNCTION as the row this hook feeds. So this card alone composes THREE
 * different answers to "which nodes are options", and the claim that it
 * composed one told the next reader the seam was closed. Corrected by
 * measurement rather than reworded: a false scope claim in a docblock is
 * inherited, and it is inherited as settled.
 *
 * THE MANIFEST, swept with `rg -a` at this tip over the two files this card
 * renders from plus the panel's producer. **Scope stated: these three files
 * only. This is NOT a repo-wide claim** — it says nothing about the inspector,
 * the compare tab or the pre-analysis panels, none of which were searched.
 *
 *   1. `resolveNodeTypeLiteral` — `node.type ?? data.kind ?? data.type`. The
 *      DECLARED domain owner, and what this hook now asks. A strict superset of
 *      2–4.
 *   2. `useSupportShareRunWideAbsent.ts:63` — `node.type !== 'option'`. ⭐ This
 *      is the one in the same conjunction: the `option-result-unavailable` row
 *      reads `!supportShareRunWideAbsent` beside this hook's answer, so two
 *      different option sets decide one sentence.
 *   3. `OptionNode.tsx:213`, `:473`, `:734`, `:1140` — four copies of
 *      `n.type === 'option' || n.data?.type === 'option'`. A THIRD spelling:
 *      it reads `data.type` and is blind to `data.kind`.
 *   4. `useResultsSectionData.ts:2024` — `data.kind === 'option'`, the panel's.
 *      Blind to `node.type`, i.e. the exact complement of 3.
 *
 * So `addNode` (`store.ts:3377`, writes `data: { label }` only) and
 * `addNodeWithEdge` (`:3478`, writes `data: { label, kind: type }`) land a node
 * in different subsets of these four, and every function name matches.
 *
 * ⛔ ROUTING 2–4 THROUGH `resolveNodeTypeLiteral` IS NOT DONE HERE, and the
 * refusal is the point of the note. Each is a WIDENING — more nodes enter each
 * set — and 4 decides which nodes become `OptionResult`s across the whole panel
 * (ranking, winner selection, the comparison table). Five behaviour changes
 * across two surfaces is a different lane with a different blast radius. What
 * this one owns is that the canvas asks the domain owner instead of keeping a
 * fifth private spelling, and that the other four are now NAMED with their
 * line numbers rather than summarised into a number that was wrong.
 */
import { useCanvasStore } from '../store'
import { resolveOptionInterventionCount } from '../nodes/shared/optionInterventionCount'
import { useAnalysisResultsAreCurrent } from './useAnalysisResultsAreCurrent'
import { resolveNodeTypeLiteral } from '../domain/nodes'
import type { ResultsReport } from '../../components/results/types'
import {
  deriveNotAnalysedReason,
  isAnalysedOption,
  runAnalysedAnyOption,
  type NotAnalysedReason,
} from '../../components/results/utils/notAnalysedOptions'

/**
 * `null` when this option was in the run, when the question cannot be asked
 * honestly, or when we are not entitled to the answer. A
 * {@link NotAnalysedReason} when the run left it out.
 *
 * ## ⭐⭐ THE FOURTH WORLD, AND THE TWO THINGS THIS HOOK GOT WRONG ABOUT IT
 *
 * The world is real. `results.status` SURVIVES a graph edit: `pushToHistory`
 * (`store.ts:2030`) sets `graphEditedSinceLastRun: true` and
 * `analysisStateReady: false` and never touches `results`. So a run completes
 * on A and B, the user adds C and wires it to a factor, and C arrives here with
 * an intervention edge and no entry — `deriveNotAnalysedReason` answers
 * `not_returned`, and the card said *"The analysis returned no result for this
 * option"*. It returned nothing about C **because C did not exist.** That
 * sentence blames the engine for the user's own edit, and it is the defect this
 * arm exists to stop.
 *
 * ⛔⛔ **FIRST ERROR: THE GATE WAS `graphEditedSinceLastRun`, AND THAT FLAG
 * CANNOT ANSWER THE QUESTION.** `resultsLoadHistorical` (`store.ts:6026`) and
 * `resultsHydrateFromSupabase` (`:6097`) each reset it to `false` in the SAME
 * `set()` that writes `results.status: 'complete'`. So after any reload,
 * scenario switch or restore, the gate opened and the false engine-blaming
 * sentence came back — on a result computed against a graph this session has
 * never seen, i.e. exactly the case the arm was written for. The hook claimed
 * it "fails toward saying less"; measured, it failed toward saying the false
 * thing, on the most ordinary path in the product. The gate is now
 * {@link useAnalysisResultsAreCurrent}, whose header carries the full
 * measurement and the reason `analysisFreshnessDirty` is not the remedy either.
 *
 * ⛔⛔ **SECOND ERROR: THE REPLACEMENT SENTENCE ASSERTED MORE THAN THE GATE
 * COULD LICENSE.** The withheld claim was swapped for a fourth reason,
 * `graph_edited_since_run`, whose copy read *"The graph has changed since that
 * analysis ran"*. But the honest signal does not say that. `false` from the
 * currency hook pools `'changed'`, `'cannot_confirm'`, `'none'` and
 * `'never_run'` — and `'cannot_confirm'` (a restored run, a CEE-stated
 * `unknown`, a run that finished with no verdict) is not a statement that
 * anything changed. Gating a CHANGE assertion on a NOT-CONFIRMED signal is the
 * same fabrication one level up. So the fourth reason, its type and its copy are
 * WITHDRAWN, and the arm simply returns `null`.
 *
 * ⭐ WHAT `null` COSTS AND WHAT IT BUYS. The card falls back to
 * `option-result-unavailable-*` — *"On the data so far, no support percentage
 * for this option"* — which is the pooled sentence this hook was built to split.
 * That is a real loss of precision and it is the chosen direction: pooled-but-
 * true beats specific-and-false, and it is what "withhold rather than gate on a
 * flag that lies" means here. The split still happens on every run the product
 * can vouch for.
 *
 * ⚠ THE GATE COVERS `not_returned` ONLY, AND POOLING `no_interventions` IN WOULD
 * BE A WORSE CARD. `no_interventions` is a property of the graph AS IT IS NOW —
 * this option has no intervention edges — so it is true whatever the run saw,
 * and "say what it changes" stays actionable. It needs no currency licence, and
 * withholding it would delete the one arm that carries a next step. The two arms
 * rest on different facts and each keeps its own.
 *
 * ⛔ AND THE FLAG'S OWN RULING IS NOW HONOURED RATHER THAN ARGUED AROUND.
 * `OutputsDock`, `ActionStrip` and `deriveAnalysisDisplayState` each record that
 * `graphEditedSinceLastRun` "fabricated 'stale'" and route *"are these results
 * current?"* through the composed CEE freshness semantic. The previous version
 * of this docblock cited that ruling and then read the flag anyway, on the
 * grounds that a GATE is not a VERDICT. That distinction is sound and it was
 * irrelevant: a gate built on a false fact is false, whatever it is called.
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
  // ⚠ READ BEFORE THE SELECTOR, NOT INSIDE IT. It is a hook of its own (three
  // store subscriptions plus the shared classifier), so it cannot be called
  // from within a zustand selector; the selector below closes over its value,
  // which is a primitive, so a change of currency re-renders and re-evaluates
  // the selector exactly once.
  const resultsAreCurrent = useAnalysisResultsAreCurrent()

  // ⚠ THE SELECTOR CARRIES ITS OWN RETURN ANNOTATION, AND IT IS LOAD-BEARING.
  // Without it TypeScript infers the selector's return type from its bodies and
  // WIDENS the returned literals to `string`, so zustand's `U` resolves to
  // `string | null` and the outer signature stops being a union of known
  // reasons. Annotating here also makes every branch checked against the
  // vocabulary rather than merely assignable at the call site.
  return useCanvasStore((state): NotAnalysedReason | null => {
    if (state.results.status !== 'complete') return null
    const report = state.results.report
    if (!report) return null
    const optionProbabilities =
      (report as unknown as ResultsReport).option_probabilities ?? {}

    // The USER'S GRAPH is the left side of the join, resolved through the
    // DOMAIN OWNER of "what kind of node is this" rather than by a private
    // field read — see the corrected premise in this module's header for what
    // the private read got wrong, and the manifest for the six predicate sites
    // that remain outside the owner.
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

    // MT-21: a linked option with NO values is `no_interventions`, not an
    // engine miss — counted by the one owner of "how many values".
    const reason = deriveNotAnalysedReason(optionNodeId, state.edges, optionNodeIds, (oid) =>
      resolveOptionInterventionCount(oid, {
        ceeOptions: state.ceeAnalysisReady?.options,
        nodeInterventions: (state.nodes.find((n) => n.id === oid)?.data as { interventions?: unknown } | undefined)?.interventions,
      }),
    )

    // ⭐⭐ THE ONE ARM THAT BLAMES THE ENGINE IS WITHHELD UNLESS WE CAN VOUCH
    // FOR THE RESULT.
    //
    // `not_returned` is the claim "the run HAD this option and answered nothing
    // about it". That is only ours to make while the result on screen is
    // confirmably about the graph in front of the user. When it is not, we
    // cannot tell that world from "this option was never submitted", and we
    // cannot say which — `false` here pools 'changed' with 'cannot_confirm', so
    // there is no replacement sentence to reach for either. Nothing is
    // returned; the card falls back to the pooled-but-true line below it.
    //
    // ⚠ `no_interventions` IS NOT GATED. It reports the graph as it is now, not
    // as the run saw it, so it needs no licence from the currency signal — and
    // it is the only arm carrying an action.
    if (reason === 'not_returned' && !resultsAreCurrent) return null

    return reason
  })
}
