/**
 * A SIGNED-IN RELOAD OF THE SAME SCENARIO MUST NOT BLANK THE ANSWER.
 *
 * ── THE USER-VISIBLE DEFECT ─────────────────────────────────────────────────
 * A signed-in user opens `/scenario/:id`, runs an analysis, refreshes. The
 * graph, the constraints and the conversation all come back. Only the ANSWER
 * does not — the results panel drops to its pre-analysis state.
 *
 * ── THE MECHANISM, AND WHAT IT IS *NOT* ─────────────────────────────────────
 * It is NOT the boot verdict leg's `complete_current` decline
 * (`hydrate/applyScenarioAnalysisRead.ts`). That mechanism is real and
 * deployed, and it withholds only the freshness VERDICT — reversing it would
 * add a SECOND results writer racing the real cause, and the user-facing
 * outcome would then depend on whether Supabase or Render answered first.
 * Nothing in this spec touches it.
 *
 * The real chain, in order:
 *   1. `/scenario/:id` is the only route running the Supabase scenario load
 *      (`routes/CanvasMVP.tsx`), gated on `isPersistenceActive`.
 *   2. `useScenario.loadScenario` sets `results: createIdleResults()`
 *      UNCONDITIONALLY on every load — including a reload of the SAME scenario.
 *   3. Its only repopulator is gated on
 *      `row.analysis_status === 'ready' && row.analysis != null`.
 *   4. THAT COLUMN HAS NO CURRENT WRITER on the deployed V5 path —
 *      `persistAnalysisSuccess` → `scenarioService.storeAnalysis` was retired
 *      with the direct browser→PLoT `/v2/run` path (ROADMAP 2.1229). So the
 *      repopulator is never satisfiable for a run this product actually
 *      performs.
 *   5. ORDERING IS DECISIVE. `ReactFlowGraph`'s init effect — where
 *      `restoreAnalysisFromAutosave` runs — fires FIRST as a child effect.
 *      `loadScenario` lands asynchronously AFTERWARDS and clears. So even a
 *      SUCCESSFUL autosave restore is wiped.
 *
 * ── THE ESTATE ALREADY FORBIDS THIS ON THE OTHER PATH ───────────────────────
 * `canvas/store/idleResults.ts` and both twins in
 * `store/__tests__/loadScenarioClearsPreviousAnalysis.spec.ts` say clearing on
 * a non-switch boot restore "would blank a freshly computed analysis on an
 * ordinary page reload". The Supabase twin took exactly the route the
 * localStorage twin was forbidden.
 *
 * ── WHAT THIS SPEC DRIVES, AND WHAT IT CANNOT PROVE ─────────────────────────
 * The run is produced by the LIVE handler (`applyV5State`'s `analysis_result`
 * branch) against the REAL canvas store, persisted through the REAL autosave
 * projection into the REAL `localStorage` slot, and restored by the REAL boot
 * helper — no self-authored results fixture anywhere on the path (CLAUDE.md
 * trap 16: *a fixture you wrote yourself is not evidence about the wire*). The
 * Supabase half is the shared `useScenario` harness.
 *
 * It does NOT prove `ReactFlowGraph`'s mount effect calls the restore helper,
 * and it is not a rendering claim — jsdom cannot establish either. Status-ladder
 * rung for everything below: TESTED.
 *
 * ── BINDING ─────────────────────────────────────────────────────────────────
 * Every assertion binds to the run by IDENTITY — the response hash THIS run
 * produced, read back off the store before the second load — never by a value
 * predicate another run's report could satisfy (CLAUDE.md trap 19). Each
 * journey pins its own precondition in-test, so a failure can never be the
 * fixture failing to arm (CLAUDE.md trap 13b).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// ⚠ MUST STAY ABOVE the imports of the code under test — the `vi.mock`
// factories close over this harness. See the harness header.
import {
  HARNESS_NODES,
  supabaseMockModule,
  authMockModule,
  routerMockModule,
  resetScenarioHarness,
  setScenarioRow,
  scenarioRow,
} from '../../test/helpers/useScenarioSupabaseHarness'

vi.mock('../../lib/supabase', () => supabaseMockModule())
vi.mock('react-router-dom', () => routerMockModule())
vi.mock('../../contexts/AuthContext', () => authMockModule())

import { useScenario } from '../useScenario'
import { useCanvasStore } from '../../canvas/store'
import {
  loadAutosave,
  saveAutosave,
  type AutosaveData,
} from '../../canvas/store/scenarios'
import {
  projectAutosaveData,
  autosaveSourceFromStore,
} from '../../canvas/store/autosaveProjection'
import { restoreAnalysisFromAutosave } from '../../canvas/store/restoreAnalysisFromAutosave'
import { applyV5State, type V5ApplicatorStore } from '../../v5/applyV5State'
import { classifyAnalysisStateSource } from '../../canvas/hooks/useAnalysisStateSource'
import { composeAnalysisState } from '../../canvas/state/analysisStateSelector'

// ---------------------------------------------------------------------------
// Identities. Real UUIDs — the auth boundary and the autosave scenario-id guard
// both reject non-UUIDs, and a stub id hides exactly the bugs this pins.
// ---------------------------------------------------------------------------

const SCENARIO_A = '46609760-2a3f-4c1d-9f80-1b6c2d5e7a01'
const SCENARIO_B = '7957639a-11cd-4e02-8b47-9f0a3c6d2e15'

/** The live V5 `analysis_result` block shape (captured from staging). */
const analysisBlock = {
  type: 'analysis_result' as const,
  summary: 'Buy Freehold Unit Outright currently leads by 78 percentage points.',
  leading_option_id: 'opt_freehold',
  win_probabilities: { opt_freehold: 0.86, opt_relocate: 0.08, opt_renew: 0.06 },
  enrichment: {
    factor_sensitivity: [
      {
        factor_id: 'fac_retention',
        factor_label: 'Patient Retention Rate at Site',
        sensitivity: 0.75,
        direction: 'positive' as const,
      },
    ],
  },
}

function v5Response(blocks: unknown[]) {
  return {
    response_version: 2,
    assistant_text: '',
    blocks,
    suggested_actions: [],
    insights: [],
    stage_indicator: 'analyse',
  } as never
}

/** The graph the run is computed over. */
function graphAtRun() {
  return [
    { id: 'goal-1', type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue' } },
    { id: 'factor-1', type: 'factor', position: { x: 0, y: 100 }, data: { kind: 'factor', label: 'Spend' } },
  ] as never
}

/** The same graph plus one node — "the user changed the model after the run". */
function graphAfterEdit() {
  return [
    ...(graphAtRun() as unknown as Array<Record<string, unknown>>),
    { id: 'factor-2', type: 'factor', position: { x: 0, y: 200 }, data: { kind: 'factor', label: 'Churn' } },
  ] as never
}

/**
 * The applicator store, built from the REAL canvas store — not a double.
 * `resultsComplete` here is the real action, so producer → store → localStorage
 * is the deployed chain. A `vi.fn()` double would pass against broken code too.
 */
function realApplicatorStore(): V5ApplicatorStore {
  const s = useCanvasStore.getState()
  return {
    setCurrentStage: s.setCurrentStage,
    updateNode: s.updateNode,
    updateEdgeData: s.updateEdgeData,
    setRunMeta: s.setRunMeta,
    setCeeAnalysisReady: s.setCeeAnalysisReady,
    setAnalysisFreshness: s.setAnalysisFreshness,
    resultsComplete: s.resultsComplete,
    nodes: s.nodes,
    edges: s.edges,
    currentResultsHash: s.results.hash ?? null,
  } as V5ApplicatorStore
}

/**
 * ⭐ THE ROW SHAPE THE DEPLOYED V5 PATH ACTUALLY PRODUCES.
 *
 * `analysis_status` stays at its `'none'` default and `analysis` stays null,
 * because the only writer of those two columns
 * (`persistAnalysisSuccess` → `scenarioService.storeAnalysis`) has ZERO
 * non-test call sites at this tip. Every scenario row a real V5 run leaves
 * behind has THIS shape, and `useScenario.loadScenario`'s repopulator cannot
 * fire on it.
 */
function deployedShapedRow(id: string, nodes: unknown = HARNESS_NODES) {
  return scenarioRow(id, { nodes, edges: [] })
}

/**
 * Run a real V5 analysis on `scenarioId` and persist it the way the live path
 * does. Returns the response hash the run produced — the identity every later
 * assertion binds to.
 */
function runV5AnalysisOnScenario(scenarioId: string): string {
  useCanvasStore.setState({
    nodes: graphAtRun(),
    edges: [] as never,
    results: { status: 'idle', progress: 0 },
    currentScenarioId: scenarioId,
    hasCompletedFirstRun: false,
  } as never)

  // Exactly the deployed sequence: `resultsAnalysing` (never `resultsStart`,
  // so no seed), then applyV5State's analysis_result branch.
  useCanvasStore.getState().resultsAnalysing()
  applyV5State(v5Response([analysisBlock]), realApplicatorStore())

  const produced = useCanvasStore.getState().results
  // PRECONDITION, in-test: the run actually landed. Without this every
  // assertion below could pass against a results slice that was never
  // populated — the fixture failing to arm looks exactly like a working fix.
  expect(produced.status).toBe('complete')
  expect(produced.report).toBeTruthy()
  const hash = produced.hash
  expect(typeof hash).toBe('string')
  expect(hash).toBeTruthy()

  return hash as string
}

/** Persist the store through the REAL autosave projection, as the live path does. */
function persistAutosave(): AutosaveData {
  saveAutosave(
    projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState() as never)),
  )
  const stored = loadAutosave()
  expect(stored).toBeTruthy()
  return stored as AutosaveData
}

/**
 * The reload: the page goes away, `localStorage` does not, and
 * `ReactFlowGraph`'s init effect restores from the autosave record BEFORE
 * `loadScenario`'s Supabase round-trip resolves.
 *
 * Returns the restored hash so the caller can pin the precondition by identity.
 */
function simulateReloadRestore(): { restored: boolean } {
  // ⚠ `store.reset()` is a CANVAS reset, not a page load — it deliberately
  // leaves `results` and the analysis slices alone (read it: nodes, edges,
  // history, selection, ids, deletion record, first-run flag). Using it alone
  // would leave the previous run's results in place and every assertion below
  // would pass with the defect intact. The cold-start values are restated here
  // from the store's own initial state, and the idle precondition is asserted
  // rather than assumed.
  useCanvasStore.getState().reset()
  useCanvasStore.setState({
    results: { status: 'idle', progress: 0 },
    previousReport: null,
    currentScenarioId: null,
    ceeAnalysisReady: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    analysisStateV1: null,
    v5AnalysisFact: null,
    hasCompletedFirstRun: false,
    nodes: [],
    edges: [],
  } as never)
  expect(useCanvasStore.getState().results.status).toBe('idle')
  expect(useCanvasStore.getState().v5AnalysisFact).toBeNull()

  const restored = restoreAnalysisFromAutosave(
    loadAutosave(),
    useCanvasStore.getState().resultsLoadHistorical,
  )
  return { restored }
}

let memoPoisonCounter = 0

beforeEach(() => {
  vi.clearAllMocks()
  // Re-arms the spies, including the `PGRST116` "no rows" arm. Must run AFTER
  // clearAllMocks, which strips the implementations.
  resetScenarioHarness()
  localStorage.clear()
  // ⚠ `saveAutosave` MEMOISES the last payload it wrote, in MODULE scope
  // (`scenarios.ts`'s `lastAutosavePayload`), and skips a byte-identical
  // rewrite. `localStorage.clear()` does not reset that memo, so two tests
  // whose records differ only by a `Date.now()` that landed in the SAME
  // millisecond have the second write SILENTLY SKIPPED — `loadAutosave()` then
  // returns null and the test fails inside `persistAutosave`, nowhere near the
  // cause. Measured as an intermittent ~1-in-6 failure once this file grew past
  // 15 tests; invisible before that only because collisions were rare.
  // Poison the memo with a record no test can produce, then clear the slot.
  saveAutosave({
    timestamp: 0,
    nodes: [],
    edges: [],
    scenarioId: `memo-poison-${++memoPoisonCounter}`,
  } as AutosaveData)
  localStorage.clear()
  useCanvasStore.getState().reset()
})

// ---------------------------------------------------------------------------
// THE PROBE — the failing signature this lane exists to turn green
// ---------------------------------------------------------------------------

describe('re-opening the SAME scenario a V5 run just analysed', () => {
  it("PROBE: re-opening the SAME scenario a V5 run just analysed > keeps THIS run's report on screen", async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    const autosave = persistAutosave()

    // PRECONDITIONS PINNED IN-TEST — the record carries THIS run and THIS
    // scenario. A restore that silently found nothing would otherwise be
    // indistinguishable from the defect.
    expect(autosave.analysis?.hash).toBe(runHash)
    expect(autosave.scenarioId).toBe(SCENARIO_A)

    const { restored } = simulateReloadRestore()
    expect(restored).toBe(true)

    const afterRestore = useCanvasStore.getState().results
    expect(afterRestore.status).toBe('complete')
    expect(afterRestore.hash).toBe(runHash)

    // The row Supabase actually serves for a scenario a V5 run has analysed.
    const row = deployedShapedRow(SCENARIO_A)
    // PINNED: this row CANNOT satisfy `loadScenario`'s repopulator, so anything
    // green below is the preservation gate doing the work and not the overlay.
    expect(row.analysis_status).not.toBe('ready')
    expect(row.analysis).toBeNull()
    setScenarioRow(SCENARIO_A, row)

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    // THE DEFECT: at the pre-fix HEAD this is 'idle' — the answer is gone.
    const afterLoad = useCanvasStore.getState().results
    expect(afterLoad.status).toBe('complete')
    // Bound by IDENTITY to THIS run, never "some report is present".
    expect(afterLoad.hash).toBe(runHash)
    expect(afterLoad.report).toBeTruthy()
  })
})

// ---------------------------------------------------------------------------
// THE OPPOSITE-DIRECTION TWIN — a genuine switch must still clear (mandatory)
// ---------------------------------------------------------------------------

describe('a genuine scenario switch still clears the restored answer', () => {
  it("does not leak scenario A's restored report onto scenario B", async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    persistAutosave()
    simulateReloadRestore()

    // PRECONDITION: A's answer really is on screen, stamped with A's run.
    expect(useCanvasStore.getState().results.hash).toBe(runHash)

    setScenarioRow(SCENARIO_B, deployedShapedRow(SCENARIO_B))

    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_B)
    })

    const afterB = useCanvasStore.getState().results
    expect(afterB.status).toBe('idle')
    expect(afterB.report ?? null).toBeNull()
    // Bound by IDENTITY: B must not be showing anything stamped with A's run.
    expect(afterB.hash).not.toBe(runHash)
  })

  it("clears the previous scenario's delta baseline on that same switch", async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    persistAutosave()
    simulateReloadRestore()
    expect(useCanvasStore.getState().results.hash).toBe(runHash)

    // A delta baseline whose option key carries A's identity, so the assertion
    // below cannot be satisfied by any other scenario's baseline.
    useCanvasStore.setState({
      previousReport: {
        options: { [`opt-${runHash}`]: { winProbability: 0.61, outcomeMean: 1234 } },
        rankingStability: 0.9,
      },
    } as never)

    setScenarioRow(SCENARIO_B, deployedShapedRow(SCENARIO_B))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_B)
    })

    expect(useCanvasStore.getState().previousReport).toBeNull()
  })

  it('an UNSTAMPED completed report is still cleared by any load — the gate fails CLOSED', async () => {
    // The stamp is the ONLY thing that preserves. A report the store holds for
    // reasons this gate cannot vouch for (a palette pick, an in-session run)
    // must keep the pre-existing clear behaviour, or the fix widens into
    // "loadScenario stops clearing", which is the leak defect all over again.
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    expect(useCanvasStore.getState().results.hash).toBe(runHash)
    // No restore ran, so no stamp exists — assert that, rather than assume it.
    expect(
      (useCanvasStore.getState().results as { restoredForScenarioId?: unknown })
        .restoredForScenarioId ?? null,
    ).toBeNull()

    setScenarioRow(SCENARIO_A, deployedShapedRow(SCENARIO_A))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    expect(useCanvasStore.getState().results.status).toBe('idle')
  })
})

// ---------------------------------------------------------------------------
// FRESHNESS — the acceptance condition, not an extra
// ---------------------------------------------------------------------------

/**
 * Compose the analysis state the surfaces read, from the REAL store, using the
 * REAL classifier and the REAL composer.
 *
 * `canonicalFlagOn` is an explicit INPUT because `isV5CanonicalAnalysisEnabled`
 * is a module-load constant that resolves FALSE under vitest — reading it here
 * would silently test a posture the product does not deploy. The deployed
 * posture is DERIVED (not asserted) by the netlify.toml test below.
 */
function composeFromStore(canonicalFlagOn: boolean) {
  const s = useCanvasStore.getState()
  const { source } = classifyAnalysisStateSource({
    canonicalFlagOn,
    reportPresent: !!s.results?.report,
    reportHash: s.results?.hash ?? null,
    currentScenarioId: s.currentScenarioId,
    fact: s.v5AnalysisFact,
  })
  return {
    source,
    composed: composeAnalysisState({
      analysisState: s.analysisStateV1,
      freshness: s.analysisFreshness,
      dirty: s.analysisFreshnessDirty,
      source,
      resultsStatus: s.results?.status,
      resultsStartedAt: s.results?.startedAt,
      importHold: s.importPendingServerRegistration,
      hasReport: s.results?.report != null,
      ceeAnalysisReadyStatus: s.ceeAnalysisReady?.status,
      aiPanelV2On: true,
    }),
  }
}

describe('a preserved answer is never presented as current', () => {
  it('DERIVED POSTURE: the deployed staging build bakes the canonical-analysis flag ON', () => {
    // The freshness guarantee below is scoped to that posture, so the posture
    // is derived from the deploy config rather than inherited from a comment.
    // `v5CanonicalAnalysis` has NO `defaultValue` in `flags.ts` — it is ON only
    // because the deploy sets it.
    const netlify = readFileSync(resolve(process.cwd(), 'netlify.toml'), 'utf8')
    expect(netlify).toMatch(/VITE_V5_CANONICAL_ANALYSIS\s*=\s*"true"/)
  })

  it('⭐ the graph CHANGED between the run and the reload — the restored answer reads results_stale, not complete', async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)

    // The user edits the model after the run. The autosave record therefore
    // carries the NEW graph beside the OLD answer — exactly what the live
    // projection writes, because `analysis` is only rewritten by a completion.
    useCanvasStore.setState({ nodes: graphAfterEdit() } as never)
    const autosave = persistAutosave()
    expect(autosave.analysis?.hash).toBe(runHash)
    expect(autosave.nodes).toHaveLength(3)

    simulateReloadRestore()
    expect(useCanvasStore.getState().results.hash).toBe(runHash)

    // Supabase serves the CHANGED graph — the model the user is now looking at
    // is not the model this answer was computed over.
    setScenarioRow(SCENARIO_A, deployedShapedRow(SCENARIO_A, graphAfterEdit()))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    // The answer is preserved …
    const after = useCanvasStore.getState()
    expect(after.results.status).toBe('complete')
    expect(after.results.hash).toBe(runHash)

    // … and THE MECHANISM that keeps it honest, MEASURED rather than assumed.
    // `v5AnalysisFact` is SESSION-ONLY and never restored — the store has no
    // `persist()` middleware and `AutosaveData` carries no such field — so it
    // is absent after any reload, whatever the load does. That, on its own, is
    // what leaves a reloaded report with no run fact.
    //
    // ⚠ An earlier version of this comment also claimed `hydrateGraphSlice`
    // nulls `v5AnalysisFact` "on every load carrying nodes". It does not.
    // Enumerated with a contrast control: `hydrateGraphSlice` nulls
    // `analysisFreshness`, `analysisFreshnessDirty`, `analysisRefusalNotice`
    // and `analysisStateV1` on a load carrying nodes — the contrast fires — but
    // the only writers of `v5AnalysisFact: null` are the store's initial state,
    // `importCanvas` and `resetCanvas`. The three assertions below are true;
    // only the mechanism named for the first one was wrong.
    //
    // ⚠ `analysisFreshness` is NULL here, not the `'unknown'` /
    // `hydrated_without_capture` marker `resultsLoadHistorical` writes: this
    // load overwrote it. That is pre-existing behaviour, and it is why the
    // stale mark cannot rest on the freshness slice — it rests on the orphan
    // classification below, which is derived from the ABSENCE of a fact.
    expect(after.v5AnalysisFact).toBeNull()
    expect(after.analysisFreshness).toBeNull()
    expect(after.analysisStateV1).toBeNull()

    const { source, composed } = composeFromStore(true)
    expect(source).toBe('orphaned_plot_result')
    expect(composed.trust.orphaned).toBe(true)
    // THE ACCEPTANCE CONDITION: dimmed prior result + rerun CTA, never a green
    // completion claim over a model that has moved.
    expect(composed.displayState.state).toBe('results_stale')
  })

  it('CONTRAST CONTROL — the same composer says `complete` for an in-session run, so `results_stale` is a discrimination and not a constant', async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    useCanvasStore.setState({ nodes: graphAfterEdit() } as never)
    persistAutosave()
    simulateReloadRestore()
    setScenarioRow(SCENARIO_A, deployedShapedRow(SCENARIO_A, graphAfterEdit()))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    // Everything above is byte-identical to the previous test. The ONE
    // difference: a live run fact for THIS scenario, matching THIS hash — the
    // state a run performed in the current session leaves behind.
    useCanvasStore.setState({
      v5AnalysisFact: {
        scenarioId: SCENARIO_A,
        analysisHash: runHash,
        hasRunAnalysisFact: true,
        freshness: 'fresh',
        freshnessReason: null,
        rawBlocks: [],
        updatedAt: Date.now(),
      },
    } as never)

    const { source, composed } = composeFromStore(true)
    expect(source).toBe('cee_v5_run_analysis')
    expect(composed.trust.orphaned).toBe(false)
    expect(composed.displayState.state).toBe('complete')
  })

  it('the unchanged-graph reload is marked the same way — the guarantee does not depend on detecting the edit', async () => {
    // Stated because it is the honest scope of the mark: the orphan
    // classification fires on EVERY reloaded report, so "changed" and
    // "unchanged" both read results_stale. That is a fail-CLOSED direction —
    // it can over-warn, it cannot present a moved model as current.
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    persistAutosave()
    simulateReloadRestore()
    setScenarioRow(SCENARIO_A, deployedShapedRow(SCENARIO_A))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    expect(useCanvasStore.getState().results.hash).toBe(runHash)
    const { composed } = composeFromStore(true)
    expect(composed.displayState.state).toBe('results_stale')
  })
})

// ---------------------------------------------------------------------------
// ⭐ THE STAMP MUST NEVER SURVIVE ONTO A SLICE IT WAS NOT COMPUTED FOR
//
// ONE WRITER, TEN CARRIERS. `resultsLoadHistorical` is the only PRODUCER of
// `restoredForScenarioId` — and it is nowhere near the only writer of
// `results`. Enumerated at the bytes rather than inherited
// (`rg -n 'results:\s*\{' src/canvas/store.ts` → 16 sites), TEN of them carry
// the previous slice forward with `...s.results`: `resultsConnecting`,
// `resultsProgress`, `resultsComplete` and its duplicate-run follow-up,
// `resultsError`, `resultsCancelled`, `resultsAnalysing`, both arms of
// `resultsSettle`, and `resultsHydrateFromSupabase`.
//
// THE HARM A LEAK CAUSES, and why it is worse than the defect this PR fixes.
// A boot restore stamps A. The user then runs a NEW analysis in the same
// session; the stamp rides `resultsComplete`'s spread onto the fresh slice and
// STILL EQUALS A. A later `loadScenario(A)` — which REPLACES the graph with
// whatever Supabase serves — would then preserve that answer over a model it
// was not computed on; and because an in-session run DOES mint a
// `v5AnalysisFact`, the orphan classification that keeps a restored answer
// honest never fires, so it renders `complete`. A lost answer becomes a
// CONFIDENTLY WRONG one.
//
// The fix is a single guard on the one path every in-store `results` write
// takes, not a `delete` repeated at ten call sites — a ten-site edit is the
// hand-maintained mirror (CLAUDE.md trap 12) and the eleventh carrier would
// ship without it, silently.
// ---------------------------------------------------------------------------

/** The stamp as the surfaces would read it — never a value predicate. */
function heldStamp(): unknown {
  return (useCanvasStore.getState().results as { restoredForScenarioId?: unknown })
    .restoredForScenarioId
}

/**
 * The V5 `analysis_result` report carries the block's `summary` STRING at
 * runtime; `results.report` is typed `ReportV1`, whose `summary` is a bands
 * object — the store's type is stale against what `applyV5State` installs.
 * Read it through ONE narrow accessor rather than casting at each assertion:
 * this string is what binds every assertion below to the run that produced it,
 * by identity and not by a value predicate another run could satisfy
 * (CLAUDE.md trap 19).
 */
function heldReportSummary(): unknown {
  const report = useCanvasStore.getState().results.report as unknown
  return (report as { summary?: unknown } | null | undefined)?.summary
}

/** A second, DIFFERENT analysis — so "the new run" is bound by identity. */
const secondAnalysisBlock = {
  ...analysisBlock,
  summary: 'Relocate to Purpose-Built Premises now leads by 12 percentage points.',
  leading_option_id: 'opt_relocate',
  win_probabilities: { opt_freehold: 0.31, opt_relocate: 0.55, opt_renew: 0.14 },
}

describe('a stale restore stamp can never ride a spread onto a later slice', () => {
  it('PROBE: a NEW run completing on top of a restored report leaves NO stamp behind', async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    persistAutosave()
    simulateReloadRestore()

    // POSITIVE CONTROL, in-test: the stamp really is there to be leaked.
    // Without this the assertion below passes just as happily against a
    // restore that never armed (CLAUDE.md trap 13).
    expect(heldStamp()).toBe(SCENARIO_A)
    expect(useCanvasStore.getState().results.hash).toBe(runHash)

    // The user runs a NEW analysis in the same session, through the REAL
    // applicator and the REAL `resultsComplete` — the deployed sequence.
    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([secondAnalysisBlock]), realApplicatorStore())

    // Bound by IDENTITY to the SECOND run, never "some report is present".
    const after = useCanvasStore.getState().results
    expect(after.status).toBe('complete')
    expect(heldReportSummary()).toBe(secondAnalysisBlock.summary)

    // THE ASSERTION. At the pre-fix HEAD the stamp is still `SCENARIO_A` here.
    expect(heldStamp()).toBeUndefined()
  })

  // Each row names a WITNESS: a field the action does not itself write, so its
  // survival proves the action really did SPREAD the previous slice. Without a
  // witness, an action that REPLACED `results` wholesale would satisfy the
  // stamp assertion for entirely the wrong reason — a guard agreeing with
  // itself (CLAUDE.md trap 13b). `resultsConnecting` overwrites `runId` and
  // `resultsHydrateFromSupabase` overwrites the report, so they cannot share
  // one witness.
  const reportSummary = heldReportSummary
  const runId = () => useCanvasStore.getState().results.runId

  it.each([
    [
      'resultsConnecting',
      () => useCanvasStore.getState().resultsConnecting('run-connecting'),
      reportSummary,
    ],
    [
      'resultsProgress',
      () => useCanvasStore.getState().resultsProgress(40),
      reportSummary,
    ],
    [
      'resultsAnalysing',
      () => useCanvasStore.getState().resultsAnalysing(),
      reportSummary,
    ],
    [
      'resultsError',
      () =>
        useCanvasStore.getState().resultsError({
          code: 'PROBE_FAILURE',
          message: 'probe',
          canRetry: true,
        } as never),
      reportSummary,
    ],
    [
      'resultsCancelled',
      () => useCanvasStore.getState().resultsCancelled(),
      reportSummary,
    ],
    [
      'resultsSettle (report arm)',
      () => {
        useCanvasStore.getState().resultsAnalysing()
        useCanvasStore.getState().resultsSettle()
      },
      reportSummary,
    ],
    [
      'resultsHydrateFromSupabase',
      () =>
        useCanvasStore.getState().resultsHydrateFromSupabase({
          results: {
            status: 'complete',
            progress: 100,
            hash: 'hydrated-elsewhere',
            report: { summary: 'a different answer entirely' } as never,
          },
          runMeta: {},
        }),
      runId,
    ],
  ])(
    '%s carries the slice forward but NOT the stamp',
    (_name, carry: () => void, witness: () => unknown) => {
      runV5AnalysisOnScenario(SCENARIO_A)
      persistAutosave()
      simulateReloadRestore()
      const witnessBefore = witness()
      expect(heldStamp()).toBe(SCENARIO_A)
      expect(witnessBefore).toBeTruthy()

      carry()

      // PRECONDITION PINNED IN-TEST: the action really did spread.
      expect(witness()).toBe(witnessBefore)
      expect(heldStamp()).toBeUndefined()
    },
  )

  it('THE CONSEQUENCE: a fresh in-session run is NOT preserved by the earlier restore’s stamp', async () => {
    const runHash = runV5AnalysisOnScenario(SCENARIO_A)
    persistAutosave()
    simulateReloadRestore()
    expect(heldStamp()).toBe(SCENARIO_A)

    useCanvasStore.getState().resultsAnalysing()
    applyV5State(v5Response([secondAnalysisBlock]), realApplicatorStore())
    const fresh = useCanvasStore.getState().results
    expect(heldReportSummary()).toBe(secondAnalysisBlock.summary)
    expect(fresh.hash).not.toBe(runHash)

    setScenarioRow(SCENARIO_A, deployedShapedRow(SCENARIO_A))
    const { result } = renderHook(() => useScenario())
    await act(async () => {
      await result.current.loadScenario(SCENARIO_A)
    })

    // Fail-CLOSED, and this is the pre-#982 behaviour for an unstamped slice:
    // the load replaces the graph with the server's, so an answer it cannot
    // vouch for goes. The alternative — preserving it because a stamp from an
    // earlier, different answer still said "A" — is the confidently-wrong
    // outcome this guard exists to prevent.
    const afterLoad = useCanvasStore.getState().results
    expect(afterLoad.status).toBe('idle')
    expect(afterLoad.report ?? null).toBeNull()
  })
})
