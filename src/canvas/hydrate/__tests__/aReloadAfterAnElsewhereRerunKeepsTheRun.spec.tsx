/**
 * ⭐ A RELOAD ONTO A RUN MADE ELSEWHERE KEEPS THAT RUN (P0 SHARED DATA, 30 Sep 2026; DL #75 5921880401).
 *
 * P0's served browser (UI `f29bc828`, CEE `5479e15e`, scenario `af640d3c`) had held the model at Run A. The model
 * was then edited (£/month → GBP/month on the goal) and re-run as Run B through the API. A cold reload showed
 * "No analysis has run yet" on Reasoning and "No comparison yet" on Compare, and logged
 * `server_graph_hydration.boot_run_currency_declined`. A FRESH browser restored Run B (R3 5921936839), so the
 * defect needs the browser to have held the older model.
 *
 * Replayed through the real `hydrateCanvasFromServer`: the reload merge adopts Run B's model and marks it edited
 * (`mergeServerGraph.ts`), and the currency leg read that mark as a user edit, `edited_since_read` with
 * `unproven: null`, although the canvas was proven equal to Run B's graph both ways.
 *
 * The three reads are P0's own captures of `GET /scenarios/af640d3c…/graph` (`output/p0-unit-served-20261001`),
 * not a self-authored wire.
 *
 * CLAIM TYPE: jsdom store + the real hydration path; `fetch` answers from the served captures. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useAnalysisState } from '../../state/analysisStateSelector'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { logger } from '../../../lib/logger'
import served from './fixtures/served-cold-reload-af640d3c.json'

// The DEPLOYED posture (`VITE_V5_CANONICAL_ANALYSIS=true`).
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isV5CanonicalAnalysisEnabled: () => true,
}))

type Read = Record<string, unknown>
const SERVED = served as unknown as { scenario_id: string; run_a: Read; unit_edited: Read; run_b: Read }
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

const RUN_B_ID = '53c2b795674a27132c1bf44f11198615f908a6a1593673a39152e09c635fdacd'
const RUN_A_ID = '90344fdc0daad2b8752c2e2c1736abcbde1468943383e779c808850e1e99458b'
/** Run B's own report hash, derived the way the store derives `currentResultsHash`. */
const RUN_B_HASH = mapV5AnalysisToReport(clone(SERVED.run_b.analysis_result) as never).model_card.response_hash

let fetchSpy: ReturnType<typeof vi.fn>
const respond = (b: unknown) =>
  fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => clone(b) } as unknown as Response)

function freshBrowser(): void {
  useCanvasStore.setState({
    currentScenarioId: SERVED.scenario_id,
    nodes: [],
    edges: [],
    goalConstraints: null,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    history: { past: [], future: [] },
    analysisStateV1: null,
    analysisFreshness: null,
    analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false,
    analysisStateReady: false,
    results: { status: 'idle', progress: 0 },
    hasCompletedFirstRun: false,
    v5AnalysisFact: null,
    limitVerdicts: null,
    runDelta: null,
  } as never)
}

/** A reload keeps the autosaved canvas (nodes, edges, goal constraints) and drops every in-memory belief. */
function reload(): void {
  const st = useCanvasStore.getState()
  const kept = { nodes: clone(st.nodes), edges: clone(st.edges), goalConstraints: clone(st.goalConstraints) }
  freshBrowser()
  useCanvasStore.setState(kept as never)
}

const declines = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls
    .filter((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined')
    .map((c) => c[1] as { reason: string; unproven: string | null })

async function bootOn(read: Read) {
  const warn = vi.spyOn(logger, 'warn')
  respond(read)
  await hydrateCanvasFromServer(SERVED.scenario_id)
  const found = declines(warn)
  warn.mockRestore()
  return found
}

/** What the panel reads: the Run on screen, its delta, and the display state. */
function onScreen() {
  const st = useCanvasStore.getState()
  return {
    runKind: st.analysisStateV1?.run_state.kind ?? null,
    resultsHash: st.results?.hash ?? null,
    deltaCurrentRunId: st.runDelta?.delta.endpoints?.current.run_id ?? null,
    deltaBoundTo: st.runDelta?.analysisHash ?? null,
    dirty: st.analysisFreshnessDirty,
    editedSinceLastRun: st.graphEditedSinceLastRun,
    display: renderHook(() => useAnalysisState()).result.current.displayState.state,
  }
}

/**
 * `ran_without_result`, not `complete`: this is P0's MRR model, whose goal figure CEE withholds (the goal's unit is
 * unknown), and a fresh browser on Run B shows the same. The CONTROL below pins that, so a reload is held to exactly
 * what a fresh browser shows.
 */
const RUN_B_ON_SCREEN = {
  runKind: 'complete_current',
  resultsHash: RUN_B_HASH,
  deltaCurrentRunId: RUN_B_ID,
  deltaBoundTo: RUN_B_HASH,
  dirty: false,
  editedSinceLastRun: false,
  display: 'ran_without_result',
}

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('PRECONDITIONS: the captures are the served sequence', () => {
  it('Run A current → edited (stale) → Run B current; the edit and Run B share one graph, Run A another', () => {
    const kind = (r: Read) => (r.analysis_state as { run_state: { kind: string } }).run_state.kind
    const identity = (r: Read) => (r.graph_identity_hash as { value: string }).value
    expect([kind(SERVED.run_a), kind(SERVED.unit_edited), kind(SERVED.run_b)]).toEqual(['complete_current', 'complete_stale', 'complete_current'])
    expect(identity(SERVED.unit_edited)).toBe(identity(SERVED.run_b))
    expect(identity(SERVED.run_a)).not.toBe(identity(SERVED.run_b))
    const delta = (SERVED.run_b.current_read as { run_delta: { endpoints: { prior: { run_id: string }; current: { run_id: string } } } }).run_delta
    expect([delta.endpoints.prior.run_id, delta.endpoints.current.run_id]).toEqual([RUN_A_ID, RUN_B_ID])
  })
})

describe('⭐ the browser held Run A, the model moved elsewhere, and a reload shows Run B and the pair', () => {
  it('CONTROL: a fresh browser on Run B shows it (R3 5921936839)', async () => {
    freshBrowser()
    expect(await bootOn(SERVED.run_b)).toEqual([])
    expect(onScreen()).toEqual(RUN_B_ON_SCREEN)
  })

  it('⭐ held Run A → reload on Run B: Run B, its results, and the Run A → Run B delta are on screen', async () => {
    freshBrowser()
    await bootOn(SERVED.run_a)
    reload()
    expect(await bootOn(SERVED.run_b), 'the merge adopting Run B is not a user edit').toEqual([])
    expect(onScreen()).toEqual(RUN_B_ON_SCREEN)
  })

  it('⭐ held Run A, no reload, a re-read on Run B: the same', async () => {
    freshBrowser()
    await bootOn(SERVED.run_a)
    expect(await bootOn(SERVED.run_b)).toEqual([])
    expect(onScreen()).toEqual(RUN_B_ON_SCREEN)
  })

  it('CONTROL: held the edited model → reload on Run B (same graph, nothing merged) shows Run B', async () => {
    freshBrowser()
    await bootOn(SERVED.unit_edited)
    reload()
    expect(await bootOn(SERVED.run_b)).toEqual([])
    expect(onScreen()).toEqual(RUN_B_ON_SCREEN)
  })
})

describe('CONTRASTS: anything that is not the read\'s own change still declines, as before', () => {
  it('a LOCAL edit before the read (dirty before the merge) still declines `edited_since_read` and keeps the mark', async () => {
    freshBrowser()
    await bootOn(SERVED.run_a)
    reload()
    useCanvasStore.getState().markAnalysisFreshnessDirty()
    const found = await bootOn(SERVED.run_b)
    expect(found.map((d) => d.reason)).toEqual(['edited_since_read'])
    expect(onScreen()).toMatchObject({ dirty: true, deltaCurrentRunId: null })
  })

  it('a canvas value the read lacks (a second baseline) still declines `canvas_not_proven_equal` and keeps the mark', async () => {
    freshBrowser()
    await bootOn(SERVED.run_a)
    reload()
    const nodes = clone(useCanvasStore.getState().nodes) as Array<{ id: string; type?: string; data: Record<string, unknown> }>
    // The merge keeps a canvas `is_baseline: true` the read does not carry (`theServedReloadProvesTheResultCurrent`).
    const option = nodes.find((n) => n.id === 'raise_pro_price_to_59')
    expect(option, 'the fixture lacks the option — the contrast is wrong, not the code').toBeDefined()
    option!.data.is_baseline = true
    useCanvasStore.setState({ nodes } as never)
    const found = await bootOn(SERVED.run_b)
    expect(found.map((d) => d.reason)).toEqual(['canvas_not_proven_equal'])
    expect(found[0].unproven).toMatch(/raise_pro_price_to_59:is_baseline/)
    expect(onScreen()).toMatchObject({ dirty: true, deltaCurrentRunId: null })
  })

  it('held Run A → reload on the STALE read: declines `not_current` and keeps the mark (Run A no longer describes the canvas)', async () => {
    freshBrowser()
    await bootOn(SERVED.run_a)
    reload()
    const found = await bootOn(SERVED.unit_edited)
    expect(found.map((d) => d.reason)).toEqual(['not_current'])
    expect(onScreen()).toMatchObject({ dirty: true, deltaCurrentRunId: null })
  })
})
