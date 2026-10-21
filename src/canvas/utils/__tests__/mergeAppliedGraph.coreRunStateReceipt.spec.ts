/**
 * #2875 — a core Run's own graph receipt is the graph its analysis was computed against.
 *
 * Core omits `analysis_ready` (CEE #3495). Its Run turn states freshness in `analysis_state.run_state`
 * (`complete_current`, with the analysis_result computed against the response's own `graph_hash`), and every turn
 * carries a `draft_graph` read back from the persisted graph. `applyV5State` already takes that run_state verdict
 * (`runStateFreshnessVerdict`, #2872) and clears the overlay. But the applied-receipt reconcile that follows asked
 * only `analysis_ready` whether the receipt was the analysed graph, so ANY non-no-op readback then called
 * `markGraphStructurallyEdited` and the live tab read "Cannot confirm…" over the Run that had just landed.
 *
 * This replays the turn handler's order on the real store: `applyV5State` with the store snapshot the handler
 * passes, then the inline graph through `attachAnalysisReadyToInlineDraftGraph` and `reconcileAppliedGraph` with the
 * options the applied-receipt call site passes (`useConversation.ts`, `reconcileAppliedGraph(inlineGraph, …)`).
 * The edit and Run turns are the served pair from `v5/__tests__/fixtures/core-freshness-5e28e10f-*.json`; the
 * trimmed Run gains the readback `draft_graph` core sends with it.
 *
 * The verdict is read through the composed semantic every freshness surface renders
 * (`classifyFreshnessForDisplay`, as `useAnalysisResultsAreCurrent` calls it).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

// The versions-restore caller's module imports the Supabase client, which throws at import without env. No network
// path is exercised here (the restore's step 4, the cold read, is not called).
vi.mock('../../../lib/supabase', () => ({
  supabase: {},
  getUserId: async () => null,
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))

import { useCanvasStore } from '../../store'
import { reconcileAppliedGraph } from '../mergeAppliedGraph'
import { backfillGoalThresholdOntoGoalNode } from '../applyDraftResult'
import { attachAnalysisReadyToInlineDraftGraph } from '../../conversation/useConversation'
import { applyV5State, runStateFreshnessVerdict } from '../../../v5/applyV5State'
import { classifyFreshnessForDisplay } from '../../store/analysisFreshness'
import { applyRestoredGraph } from '../../versions/applyRestoredModel'
import editTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-edit.json'
import runTurn from '../../../v5/__tests__/fixtures/core-freshness-5e28e10f-run.json'

type Json = Record<string, unknown>
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** The served Run's own graph_hash (= its analysis_result's computed_against_hash). */
const RUN_HASH = '19ed7f3dc288c81b'
const OTHER_HASH = 'ffffffffffffffff'

const GOAL_ID = 'usable_field_goal'
const FACTOR_ID = 'usable_field_goal__change'
const CANVAS_FACTOR_VALUE = 20
const READBACK_FACTOR_VALUE = 20.2

/** The canvas as the edit left it: the factor still shows the locally typed figure. */
function seedCanvas() {
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({
    currentScenarioId: 'scenario-5e28e10f',
    nodes: [
      { id: GOAL_ID, type: 'goal', position: { x: 400, y: 40 }, data: { kind: 'goal', label: 'Usable field' } },
      {
        id: FACTOR_ID,
        type: 'factor',
        position: { x: 40, y: 200 },
        data: { kind: 'factor', label: 'Field gain', observedState: { value: CANVAS_FACTOR_VALUE } },
      },
    ] as never,
    edges: [
      { id: `${FACTOR_ID}::${GOAL_ID}::0`, source: FACTOR_ID, target: GOAL_ID, type: 'styled', data: { weight: 0.7, direction: 'positive' } },
    ] as never,
    ceeAnalysisReady: null,
    lastAuthoritativeGraph: null,
    history: { past: [], future: [] },
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    pendingEmittedEdits: 0,
    importPendingServerRegistration: false,
  } as never)
}

/** CEE's readback of the persisted graph: the factor holds the committed figure, not the canvas's typed one. */
function readbackGraph(factorValue = READBACK_FACTOR_VALUE): Json {
  return {
    nodes: [
      { id: GOAL_ID, kind: 'goal', label: 'Usable field' },
      { id: FACTOR_ID, kind: 'factor', label: 'Field gain', observed_state: { value: factorValue } },
    ],
    edges: [{ id: `${FACTOR_ID}::${GOAL_ID}::0`, from: FACTOR_ID, to: GOAL_ID, weight: 0.7 }],
    node_count: 2,
    edge_count: 1,
  }
}

/** The served core Run turn with the readback core sends beside it. */
function coreRunTurn(patch: (r: Json) => void = () => undefined): Json {
  const r = clone(runTurn) as Json
  delete r._capture
  r.draft_graph = readbackGraph()
  patch(r)
  return r
}

/** As the turn handler does it: state apply, then the applied-receipt reconcile with the call site's options. */
function replayTurn(response: Json) {
  const s = useCanvasStore.getState()
  applyV5State(response as never, {
    ...s,
    currentResultsHash: s.results?.hash ?? null,
    backfillGoalThreshold: backfillGoalThresholdOntoGoalNode,
  } as never)
  if (!response.draft_graph) return null
  const inline = attachAnalysisReadyToInlineDraftGraph(response.draft_graph, response)
  return reconcileAppliedGraph(inline as never, {
    analysisHashUnmoved: false,
    runStateFreshness: runStateFreshnessVerdict(response),
  } as never)
}

/** The served edit turn, then the overlay the local edit set before it returned. */
function replayServedEdit() {
  const edit = clone(editTurn) as Json
  delete edit._capture
  replayTurn(edit)
  useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
}

const live = () => {
  const s = useCanvasStore.getState()
  return classifyFreshnessForDisplay(s.analysisFreshness, s.analysisFreshnessDirty, s.importPendingServerRegistration)
}

const factorValue = () =>
  ((useCanvasStore.getState().nodes.find((n) => n.id === FACTOR_ID)?.data as Json | undefined)?.observedState as
    | { value?: unknown }
    | undefined)?.value

/** A held verdict written by the store's own reducer, with the overlay left clean. */
function holdVerdict(v: Json) {
  useCanvasStore.getState().setAnalysisFreshness(v)
  useCanvasStore.setState({ analysisFreshnessDirty: false, graphEditedSinceLastRun: false } as never)
}

beforeEach(() => {
  seedCanvas()
})

describe('preconditions', () => {
  it('the served Run is core-shaped: no analysis_ready, complete_current, result computed against its own hash', () => {
    const r = coreRunTurn()
    expect(r.analysis_ready).toBeUndefined()
    expect((r.analysis_state as Json).run_state).toMatchObject({ kind: 'complete_current' })
    expect(r.graph_hash).toBe(RUN_HASH)
    expect(((r.blocks as Json[])[0]).computed_against_hash).toBe(RUN_HASH)
    expect(runStateFreshnessVerdict(r)).toEqual({
      freshness: 'fresh',
      freshness_reason: 'run_state_complete_current',
      graph_hash_at_run: RUN_HASH,
      current_graph_hash: RUN_HASH,
    })
    // The inline graph carries no legacy verdict of its own, so only the run_state projection can attest it.
    expect((attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as Json).analysis_ready).toBeUndefined()
  })
})

describe('(1) a core Run whose own receipt is a real reconcile stays current', () => {
  it('⭐ edit → Run: the readback moves the canvas, and the live freshness still reads current', () => {
    replayServedEdit()
    expect(live(), 'PRECONDITION: the edit left the model changed').not.toBe('current')

    const merged = replayTurn(coreRunTurn())

    expect(merged?.updatedNodeCount, 'PRECONDITION: the reconcile is not a no-op').toBe(1)
    expect(factorValue(), 'PRECONDITION: the canvas moved to the analysed graph').toBe(READBACK_FACTOR_VALUE)
    const s = useCanvasStore.getState()
    expect(s.analysisFreshness).toMatchObject({ freshness: 'fresh', graphHashAtRun: RUN_HASH, currentGraphHash: RUN_HASH })
    // The overlay every freshness surface reads. (The legacy `graphEditedSinceLastRun` pair is flipped by the
    // reconcile's own `pushHistory` on both lanes and has no freshness reader; it is not what this asserts.)
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(live()).toBe('current')
  })
})

describe('(2) controls: the receipt still marks the model changed', () => {
  it('the Run\'s analysis_result was computed against a DIFFERENT hash than the response\'s graph_hash', () => {
    replayServedEdit()
    const r = coreRunTurn((x) => {
      ;(x.blocks as Json[])[0] = { ...((x.blocks as Json[])[0]), computed_against_hash: OTHER_HASH }
    })
    expect(runStateFreshnessVerdict(r), 'PRECONDITION: no projection without the hash pair').toBeUndefined()
    const merged = replayTurn(r)
    expect(merged?.updatedNodeCount).toBe(1)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })

  it('the held verdict is fresh, but for a different hash pair than the receipt\'s Run', () => {
    holdVerdict({ freshness: 'fresh', freshness_reason: 'run_state_complete_current', graph_hash_at_run: OTHER_HASH, current_graph_hash: OTHER_HASH })
    expect(useCanvasStore.getState().analysisFreshness).toMatchObject({ freshness: 'fresh', graphHashAtRun: OTHER_HASH })
    expect(live(), 'PRECONDITION: current before the receipt').toBe('current')
    const r = coreRunTurn()
    const merged = reconcileAppliedGraph(attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as never, {
      analysisHashUnmoved: false,
      runStateFreshness: runStateFreshnessVerdict(r),
    } as never)
    expect(merged.updatedNodeCount).toBe(1)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })

  it('a projection whose own pair disagrees is refused even when the store holds that same pair', () => {
    holdVerdict({ freshness: 'fresh', freshness_reason: 'run_state_complete_current', graph_hash_at_run: RUN_HASH, current_graph_hash: OTHER_HASH })
    const r = coreRunTurn()
    reconcileAppliedGraph(attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as never, {
      analysisHashUnmoved: false,
      runStateFreshness: { freshness: 'fresh', freshness_reason: 'run_state_complete_current', graph_hash_at_run: RUN_HASH, current_graph_hash: OTHER_HASH },
    } as never)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('a stale run_state (complete_stale) is not an attestation', () => {
    replayServedEdit()
    const r = coreRunTurn((x) => {
      x.analysis_state = { ...(x.analysis_state as Json), run_state: { kind: 'complete_stale', computed_at: '2026-10-21T00:47:54.072Z', cause: 'graph_changed' } }
    })
    expect(runStateFreshnessVerdict(r)?.freshness).toBe('stale')
    replayTurn(r)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })

  it('a held verdict that is not fresh: the receipt\'s fresh projection alone does not clear the mark', () => {
    holdVerdict({ freshness: 'stale', freshness_reason: 'graph_hash_diverged', graph_hash_at_run: RUN_HASH, current_graph_hash: RUN_HASH })
    expect(useCanvasStore.getState().analysisFreshness?.freshness, 'PRECONDITION').toBe('stale')
    const r = coreRunTurn()
    reconcileAppliedGraph(attachAnalysisReadyToInlineDraftGraph(r.draft_graph, r) as never, {
      analysisHashUnmoved: false,
      runStateFreshness: runStateFreshnessVerdict(r),
    } as never)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('a legacy analysis_ready on the receipt outranks the run_state projection (stale wins over fresh)', () => {
    holdVerdict({ freshness: 'fresh', freshness_reason: 'run_state_complete_current', graph_hash_at_run: RUN_HASH, current_graph_hash: RUN_HASH })
    const r = coreRunTurn()
    const inline = { ...readbackGraph(), analysis_ready: { freshness: 'stale', graph_hash_at_run: RUN_HASH, current_graph_hash: RUN_HASH } }
    reconcileAppliedGraph(inline as never, {
      analysisHashUnmoved: false,
      runStateFreshness: runStateFreshnessVerdict(r),
    } as never)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })

  it('a queued local edit keeps its hold through the Run and its receipt', () => {
    replayServedEdit()
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    replayTurn(coreRunTurn())
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })

  it('an import the server has not registered keeps its hold', () => {
    replayServedEdit()
    useCanvasStore.setState({ importPendingServerRegistration: true } as never)
    replayTurn(coreRunTurn())
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })

  it('the versions-restore caller (option omitted) still marks a non-no-op restore as a change', () => {
    // Held directly (not via the Run replay), so this control does not depend on the change under test.
    holdVerdict({ freshness: 'fresh', freshness_reason: 'run_state_complete_current', graph_hash_at_run: RUN_HASH, current_graph_hash: RUN_HASH })
    expect(live(), 'PRECONDITION: a fresh Run is held and the model reads current').toBe('current')
    const applied = applyRestoredGraph({
      nodes: [
        { id: GOAL_ID, kind: 'goal', label: 'Usable field' },
        { id: FACTOR_ID, kind: 'factor', label: 'Field gain', observed_state: { value: 33 } },
      ],
      edges: [{ id: `${FACTOR_ID}::${GOAL_ID}::0`, from: FACTOR_ID, to: GOAL_ID, weight: 0.7 }],
    })
    expect(applied.updatedNodeCount).toBe(1)
    expect(factorValue()).toBe(33)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect(live()).not.toBe('current')
  })
})
