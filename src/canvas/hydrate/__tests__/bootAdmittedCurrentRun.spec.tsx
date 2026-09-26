/**
 * ⭐ A RELOAD OF A CURRENT RUN ON A REVISION CEE ADMITS STAYS CURRENT, AND RUN STAYS ENABLED (row 3 N1; UI #2103
 * independent review 5845273636 N1).
 *
 * Paul's pricing path: Run on a model CEE admits while its readiness still lists MISSING_OPTION_VALUE ×3, then
 * reload. The currency leg asked `readinessObjectsToRun(null, authority)` with no admission, read those blockers as
 * closing the gate, and declined `closes_run_gate`: the user read "can't confirm this still matches your latest
 * analysis" over a run that IS current. Restoring it alone would grey Run at render, because nothing at boot tells
 * the gate CEE admits the revision — so the read's admission is seeded as the bound admission until a turn speaks.
 *
 * CLAIM TYPE: jsdom store + the real hydration path. The read is the composed served DL turn-3 read (see the
 * fixture's `_provenance`) with `run_state` set to `complete_current` — what the read route returns for that
 * revision right after a Run with no edit. That one field is this spec's, not the wire's. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import composed from './fixtures/served-admitted-reload.06bdf585.composed.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import type { AnalysisStateV1 } from '@talchain/schemas/boundary'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { selectAnalysisReadinessAuthority } from '../../state/analysisStateSelector'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import { selectBoundMayRun } from '../../hooks/useAnalysisReady'
import { logger } from '../../../lib/logger'

type Body = {
  scenario_id: string
  graph_hash: string
  graph: { nodes: unknown[]; edges: unknown[] }
  analysis_state: AnalysisStateV1
  analysis_admission: { admitted: boolean; graph_hash: string } | null
}
const SERVED = (composed as unknown as { body: Body }).body
const SCENARIO_ID = SERVED.scenario_id

function asCurrent(b: Body): Body {
  const runState = b.analysis_state.run_state as { kind: string; computed_at?: string }
  return { ...b, analysis_state: { ...b.analysis_state, run_state: { kind: 'complete_current', computed_at: runState.computed_at } } as AnalysisStateV1 }
}

let body: Body
let debugSpy: { mock: { calls: unknown[][] }; mockRestore: () => void }

/** The Run gate exactly as the panel computes it: the bound admission from the store, no turn. */
function runAllowed(): boolean {
  const s = useCanvasStore.getState()
  return canRunAnalysis({
    graphHealth: null,
    readiness: null,
    analysisReadiness: selectAnalysisReadinessAuthority(s.analysisStateV1 ?? null),
    mayRun: selectBoundMayRun(s),
    hasBlockers: false,
    nodeCount: s.nodes.length,
    isRunning: false,
    analysisHeldOn: null,
    draftStreamPhase: 'idle',
    readinessStale: false,
  }).allowed
}

const logged = (event: string): unknown => debugSpy.mock.calls.find(([e]) => e === event)?.[1]

beforeEach(() => {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO_ID,
    nodes: [],
    edges: [],
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    ceeAnalysisReady: null,
    lastServerGraphHash: null,
    bootAdmittedRevision: null,
  } as never)
  applyDraftResult(JSON.parse(JSON.stringify(SERVED.graph)) as never, { skipHistory: true, skipAutosave: true })
  useCanvasStore.setState({
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    serverGraphIdentity: null,
    lastAuthoritativeGraph: null,
    lastServerGraphHash: null,
  } as never)
  body = asCurrent(JSON.parse(JSON.stringify(SERVED)))
  debugSpy = vi.spyOn(logger, 'debug')
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as unknown as Response))
})
afterEach(() => {
  vi.unstubAllGlobals()
  debugSpy.mockRestore()
})

describe('⭐ a reload of a CURRENT run on a revision CEE admits', () => {
  it('⭐ stays current (the currency leg restores it) and Run stays enabled', async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(logged('server_graph_hydration.boot_run_currency')).toMatchObject({ outcome: 'restored' })
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(selectBoundMayRun(useCanvasStore.getState())).toBe(true)
    expect(runAllowed()).toBe(true)
  })

  it('CONTRAST (the defect): the same read with no admission declines currency as today, and seeds nothing', async () => {
    body.analysis_admission = null
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind ?? null).not.toBe('complete_current')
    expect(useCanvasStore.getState().bootAdmittedRevision).toBeNull()
    expect(selectBoundMayRun(useCanvasStore.getState())).toBeUndefined()
  })

  it('CONTRAST (proof): a read the canvas does NOT match (an edge direction differs) seeds nothing', async () => {
    const e = body.graph.edges[0] as { effect_direction?: string }
    e.effect_direction = e.effect_direction === 'positive' ? 'negative' : 'positive'
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().bootAdmittedRevision).toBeNull()
    expect(selectBoundMayRun(useCanvasStore.getState())).toBeUndefined()
  })

  it('CONTRAST: admitted:false seeds nothing and never closes the gate on its own account', async () => {
    body.analysis_admission = { ...(body.analysis_admission as NonNullable<Body['analysis_admission']>), admitted: false }
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(useCanvasStore.getState().bootAdmittedRevision).toBeNull()
    expect(selectBoundMayRun(useCanvasStore.getState())).toBeUndefined()
  })
})

describe('the boot admission is bound exactly as a turn\'s verdict is', () => {
  beforeEach(async () => {
    await hydrateCanvasFromServer(SCENARIO_ID)
    expect(selectBoundMayRun(useCanvasStore.getState()), 'premise: seeded by the reload').toBe(true)
  })

  it('an emitted edit the server has not answered unbinds it', () => {
    useCanvasStore.setState({ pendingEmittedEdits: 1 } as never)
    expect(selectBoundMayRun(useCanvasStore.getState())).toBeUndefined()
  })

  it('a different revision on screen unbinds it', () => {
    useCanvasStore.setState({ lastServerGraphHash: 'ffffffffffffffff' } as never)
    expect(selectBoundMayRun(useCanvasStore.getState())).toBeUndefined()
  })

  it('a turn\'s own may_run wins over it — including a refusal', () => {
    useCanvasStore.setState({ ceeAnalysisReady: { may_run: false, current_graph_hash: SERVED.analysis_admission!.graph_hash } } as never)
    expect(selectBoundMayRun(useCanvasStore.getState())).toBe(false)
  })
})
