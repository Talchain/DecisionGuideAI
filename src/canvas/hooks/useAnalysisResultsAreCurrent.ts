/**
 * `useAnalysisResultsAreCurrent` — MAY A CARD SAY THIS RESULT IS ABOUT THE
 * GRAPH IN FRONT OF YOU?
 *
 * ## ⛔⛔ WHY THIS EXISTS: `graphEditedSinceLastRun` CANNOT ANSWER IT
 *
 * Two canvas lanes were briefed to gate a claim on `graphEditedSinceLastRun`
 * and both shipped it. The instruction was wrong, and the measurement that
 * refutes it is one grep (`rg -a -n "graphEditedSinceLastRun" src/canvas/store.ts`,
 * at this tip). The flag is written `false` in SIX places, and two of them are
 * fatal to it as a staleness signal:
 *
 *   · `:3176` initial state · `:4463` `importCanvas` · `:4924` `resetCanvas`
 *   · `:5418` `resultsComplete` — correct: a run just finished on this graph
 *   · **`:6026` `resultsLoadHistorical`** — resets it to `false` in the SAME
 *     `set()` that writes `results.status: 'complete'`
 *   · **`:6097` `resultsHydrateFromSupabase`** — the same, for a cold scenario
 *     load
 *
 * So after ANY reload, scenario switch or restore of a historical run, the flag
 * reads `false` — "the graph has not moved since the run" — about a result that
 * was computed on a graph this session has never seen. It fails OPEN, on the
 * single most common path in the product. It also over-fires in the other
 * direction: `historyHash` (`store.ts:2025`) includes `position`, so dragging a
 * node sets it `true` without changing anything a run would see.
 *
 * ⚠ `analysisFreshnessDirty` IS NOT THE REMEDY EITHER, and the reason it looks
 * like one is a half-measurement worth recording. It is true that
 * `pushToHistory` (`:2030`) does NOT call `markAnalysisFreshnessDirty` —
 * but `pushToHistory` is not the edit path, it is a helper the edit actions
 * call. `addNode` (`:3370`), `addNodeWithEdge` (`:3438`), `addEdge` (`:3993`),
 * the analytical `updateNode`/`updateEdge` arms (`:3546`/`:3649`), the delete
 * chokepoints, paste, duplicate and the repair paths all call
 * `invalidateAnalysisReady`, which marks the overlay unconditionally
 * (`:2890`). The overlay is therefore SET on every analysis-affecting edit —
 * and then CLEARED by `resultsLoadHistorical` and `resultsHydrateFromSupabase`
 * exactly as the legacy flag is. Read raw, both flags lie in the same
 * direction, on the same two actions.
 *
 * ## WHAT DOES ANSWER IT
 *
 * Those two actions leave behind the one field that tells the truth:
 * `analysisFreshness: { freshness: 'unknown', freshnessReason:
 * 'hydrated_without_capture' }`. That is CEE's freshness slice, and reading it
 * through the shared classifier yields `'cannot_confirm'` — never `'current'`
 * — for a restored run. This hook is that read and nothing else:
 *
 *   `classifyFreshnessForDisplay(slice, dirty, importHold) === 'current'`
 *
 * ⭐ IT DERIVES NOTHING. The classifier is the estate's ratified display
 * semantic — the `'derived'` branch of `canvas/state/analysisStateSelector.ts`,
 * and the authority `OutputsDock`, `ActionStrip` and
 * `deriveAnalysisDisplayState` were each migrated ONTO when they were taken off
 * `graphEditedSinceLastRun` (their own comments record that the flag
 * "fabricated 'stale'"). The call shape here is the one
 * `v5/blocks/useCoachingCurrency.ts:52` and
 * `components/results/AnalysisFreshnessNotice.tsx:119` already make — three
 * store fields, one classifier, no local rule.
 *
 * ⚠ THE FOURTH PARAMETER IS OMITTED ON PURPOSE, not forgotten.
 * `hasCompletedFirstRun` gates the `'changed'`/`'never_run'` fork, which sits
 * BELOW the affirmative — `classifyFreshnessForDisplay` returns `'current'` at
 * `analysisFreshness.ts:389`, before that parameter is ever read. Passing it
 * would buy a fourth subscription and change no answer this hook can give.
 *
 * ## ⚠⚠ THE HONEST LIMIT, STATED RATHER THAN HIDDEN
 *
 * This is the DERIVED branch only. When CEE states an `analysis_state` on the
 * turn, the composed selector's WIRE branch outranks it, and this hook does not
 * consult the wire. The asymmetry matters and is only safe in one direction:
 *
 *   · wire says current, derived says not → this hook WITHHOLDS. Fail-closed:
 *     the product says less than it could.
 *   · wire says refused/errored/stale while `analysis_ready` separately said
 *     `fresh` and nothing has been edited since → this hook would PUBLISH.
 *     Fail-open, and the one gap.
 *
 * It is not closed here because closing it means calling `useAnalysisState()`,
 * which composes eleven store subscriptions and reaches
 * `useAnalysisStateSource()` → `isV5CanonicalAnalysisEnabled()` from
 * `src/flags`. Measured in this tree: 17 specs under `src/canvas/nodes/__tests__`
 * mock a flags module with a `vi.mock` FACTORY, and a factory REPLACES the
 * module — the 57-copy hand-maintained-mirror trap (CLAUDE.md trap 12) that
 * `useSupportShareRunWideAbsent` was split out of `useNodeDisplayMetadata` to
 * avoid. Every consumer of this hook is a per-node canvas card rendered on
 * every frame, so that is not a cost this lane can take blind. **A lane that
 * can afford the composition should promote this hook's body to
 * `useAnalysisState().semantic === 'current'` and delete this paragraph** — the
 * consumers do not change, because the seam is here.
 *
 * ## ⚠ FAIL-CLOSED UNDER A PARTIAL STORE MOCK, AND THAT IS DELIBERATE
 *
 * A spec whose mocked state omits `analysisFreshness` yields `undefined`,
 * `resolveDisplayedFreshness` returns `null`, the classifier returns `'none'`,
 * and this returns `false`. An under-specified fixture therefore withholds the
 * claim rather than asserting it — absence degrades to saying less, never to a
 * claim nothing licensed.
 *
 * ## ONE SEAM, TWO SURFACES, ON PURPOSE
 *
 * `useCoachingCurrency`'s header makes this argument and it is adopted rather
 * than re-argued: four copies of "three subscriptions plus the classifier call"
 * is how one of them eventually drops the import-hold argument and two surfaces
 * answer "has your model moved?" differently on the same turn. That is
 * CLAUDE.md trap 21 by increments. This file is byte-identical on the two
 * branches that introduce it (`canvas/not-analysed-is-its-own-absence` and
 * `canvas/influence-reads-as-a-ranking`) so that whichever merges second is an
 * add/add of identical content rather than a conflict resolved by picking a
 * side.
 */
import { useCanvasStore } from '../store'
import { classifyFreshnessForDisplay } from '../store/analysisFreshness'

/**
 * `true` only when the last freshness verdict is an affirmative `fresh` that no
 * analysis-affecting edit and no import hold has since downgraded.
 *
 * ⛔ THE NEGATIVE IS NOT A CLAIM. `false` means "not entitled to say this is
 * current" — it pools `'changed'`, `'cannot_confirm'`, `'none'` and
 * `'never_run'`, which are four different facts. A caller may withhold on
 * `false`; it may NOT render "the graph has changed" on it, because
 * `'cannot_confirm'` (a restored run, a CEE-stated `unknown`, a run that
 * completed with no verdict) is not a statement that anything changed.
 */
export function useAnalysisResultsAreCurrent(): boolean {
  const freshnessState = useCanvasStore((s) => s.analysisFreshness)
  const freshnessDirty = useCanvasStore((s) => s.analysisFreshnessDirty)
  const importHold = useCanvasStore((s) => s.importPendingServerRegistration)
  return classifyFreshnessForDisplay(freshnessState, freshnessDirty, importHold) === 'current'
}
