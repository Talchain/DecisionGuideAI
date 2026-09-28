/**
 * ⭐ R6, THE SERVED HALF — a plain reload of a real first pass declined the currency proof, so #2252's
 * fact mint (gated on `restored`) never ran and the hero still read "Results may be outdated".
 *
 * Served UI c3f76e4f (28 Sep 2026 15:10Z, `fixtures/served-reload-c3f76e4f.json`: the reloaded canvas from
 * localStorage + the POST …/graph body the reload received). Replayed through the REAL
 * `hydrateCanvasFromServer`, the decline was
 *   `fwd:node:raise_price_to_59:is_baseline:read_lacks canvas=false`.
 * The canvas projects `is_baseline: false` on every non-baseline option; CEE's read carries the key only
 * on the baseline (`keep_49_price: true`). An absent `is_baseline` IS `false` to the engine
 * (`isBaselineOption`: `option.is_baseline === true`), so the proof now reads `false` as absent on both
 * sides. `true` is never dropped: a canvas baseline the read does not carry still declines.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { BOOT_READ_RUN_CURRENT } from '../applyBootRunCurrency'
import { useAnalysisState } from '../../state/analysisStateSelector'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { logger } from '../../../lib/logger'
import realStagingFixture from '../../../v5/__tests__/fixtures/v5-analysis-result.staging-real-shape.json'
import served from './fixtures/served-reload-c3f76e4f.json'

// The DEPLOYED posture (`VITE_V5_CANONICAL_ANALYSIS=true`): the orphan rule exists only under it.
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isV5CanonicalAnalysisEnabled: () => true,
}))

type Node = { id: string; type?: string; data: Record<string, unknown> }
type Fixture = { scenario_id: string; canvas: { nodes: Node[]; edges: unknown[]; goalConstraints: unknown }; read: Record<string, unknown> }
const SERVED = served as unknown as Fixture
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T

/** The reloaded canvas as the boot leaves it, plus the restored result on screen and no session fact. */
function seedServedReload(canvas: Fixture['canvas']): void {
  const report = mapV5AnalysisToReport(clone(realStagingFixture.blocks[0]) as never)
  useCanvasStore.setState({
    currentScenarioId: SERVED.scenario_id,
    nodes: clone(canvas.nodes),
    edges: clone(canvas.edges),
    goalConstraints: clone(canvas.goalConstraints),
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    importPendingServerRegistration: false,
    pendingEmittedEdits: 0,
    history: { past: [], future: [] },
    analysisStateV1: null,
    analysisFreshness: { freshness: 'unknown', freshnessReason: 'hydrated_without_capture' },
    analysisFreshnessDirty: false,
    results: { status: 'complete', progress: 100, report, hash: report.model_card.response_hash },
    hasCompletedFirstRun: true,
    v5AnalysisFact: null,
  } as never)
}

let fetchSpy: ReturnType<typeof vi.fn>
const respond = (b: unknown) =>
  fetchSpy.mockResolvedValue({ ok: true, status: 200, json: async () => b } as unknown as Response)
const display = () => renderHook(() => useAnalysisState()).result.current.displayState.state
const declineReason = (warn: { mock: { calls: unknown[][] } }) =>
  warn.mock.calls.find((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined')?.[1] as
    | { reason?: string; unproven?: string | null }
    | undefined

beforeEach(() => {
  fetchSpy = vi.fn()
  vi.stubGlobal('fetch', fetchSpy)
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('⭐ R6 served: the c3f76e4f reload, replayed through the real hydration', () => {
  it('PRECONDITION: the fixture is the served shape — canvas `false` on the two raises, the read carries is_baseline only on the baseline', () => {
    const canvasFlags = Object.fromEntries(SERVED.canvas.nodes.filter((n) => n.type === 'option').map((n) => [n.id, n.data.is_baseline]))
    expect(canvasFlags).toEqual({ keep_49_price: true, raise_price_to_59: false, raise_price_to_54: false })
    const readNodes = (SERVED.read.graph as { nodes: Array<Record<string, unknown>> }).nodes.filter((n) => n.kind === 'option')
    expect(Object.fromEntries(readNodes.map((n) => [n.id, 'is_baseline' in n ? n.is_baseline : 'ABSENT']))).toEqual({
      keep_49_price: true,
      raise_price_to_59: 'ABSENT',
      raise_price_to_54: 'ABSENT',
    })
    expect((SERVED.read.analysis_state as { run_state: { kind: string } }).run_state.kind).toBe('complete_current')
  })

  it('⭐ nothing edited → the currency restores, the run fact is minted, the hero reads "Analysis complete"', async () => {
    seedServedReload(SERVED.canvas)
    const warn = vi.spyOn(logger, 'warn')
    respond(clone(SERVED.read))
    await hydrateCanvasFromServer(SERVED.scenario_id)
    expect(declineReason(warn), 'the currency proof must not decline').toBeUndefined()
    expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(useCanvasStore.getState().v5AnalysisFact).toMatchObject({
      scenarioId: SERVED.scenario_id,
      hasRunAnalysisFact: true,
      freshnessReason: BOOT_READ_RUN_CURRENT,
    })
    expect(display()).toBe('complete')
  })

  it('CONTRAST: a canvas BASELINE the read does not carry (`true` vs absent) still declines, and stays dimmed', async () => {
    const canvas = clone(SERVED.canvas)
    canvas.nodes.find((n) => n.id === 'raise_price_to_59')!.data.is_baseline = true
    seedServedReload(canvas)
    const warn = vi.spyOn(logger, 'warn')
    respond(clone(SERVED.read))
    await hydrateCanvasFromServer(SERVED.scenario_id)
    expect(declineReason(warn)?.reason).toBe('canvas_not_proven_equal')
    expect(declineReason(warn)?.unproven).toMatch(/raise_price_to_59:is_baseline/)
    expect(useCanvasStore.getState().v5AnalysisFact).toBeNull()
    expect(display()).toBe('results_stale')
  })

  it('a read that states `is_baseline: false` explicitly proves equal too (the default is read the same on both sides)', async () => {
    const read = clone(SERVED.read)
    for (const n of (read.graph as { nodes: Array<Record<string, unknown>> }).nodes) {
      if (n.kind === 'option' && !('is_baseline' in n)) n.is_baseline = false
    }
    seedServedReload(SERVED.canvas)
    const warn = vi.spyOn(logger, 'warn')
    respond(read)
    await hydrateCanvasFromServer(SERVED.scenario_id)
    expect(declineReason(warn)).toBeUndefined()
    expect(display()).toBe('complete')
  })
})
