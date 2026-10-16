/** Captured cold reads: 052309Z/7adcbccb reads/06-18 and 065339Z/247ae5b4 reads/12-18.
 * Real hydration/store, gate and mounted footer. Scripted fetch only; no AI/network calls.
 * 247ae5b4's local scale_frame 80 is from reopen.json.after.state.node_data.founder_poc_testing_time.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import blocked from './fixtures/founder-blocked-reopen-7adcbccb.read.json'
import staleBlocked from './fixtures/founder-blocked-reopen-247ae5b4.read.json'
import { useCanvasStore } from '../../store'
import { applyDraftResult } from '../../utils/applyDraftResult'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { beginBootGraphRead, recordRegistrationAcknowledged, __resetBootGraphReadForTest } from '../bootGraphRead'
import { selectAnalysisReadinessAuthority, selectRunOnRecord } from '../../state/analysisStateSelector'
import { canRunAnalysis } from '../../utils/canRunAnalysis'
import { readinessNothingHasAnswered } from '../../components/pre-analysis-v3/footer/readinessDisplay'
import { PanelFooter } from '../../components/pre-analysis-v3/footer/PanelFooter'
import { logger } from '../../../lib/logger'

const rows = [
  { pin: '7adcbccb', read: blocked, obsoleteFrame: false },
  { pin: '247ae5b4', read: staleBlocked, obsoleteFrame: true },
] as const
const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value))
function seed(row: typeof rows[number]) {
  useCanvasStore.setState({ currentScenarioId: row.read.scenario_id, nodes: [], edges: [],
    lastAuthoritativeGraph: null, serverGraphIdentity: null, importPendingServerRegistration: false,
    pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null, bootAdmittedRevision: null,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, graphEditedSinceLastRun: false,
    v5AnalysisFact: null, hasCompletedFirstRun: false, results: { status: 'idle', report: null },
    history: { past: [], future: [] } } as never)
  applyDraftResult(clone(row.read.graph) as never, { skipHistory: true, skipAutosave: true })
  if (row.obsoleteFrame) useCanvasStore.setState({ nodes: useCanvasStore.getState().nodes.map(n =>
    n.id === 'founder_poc_testing_time' ? { ...n, data: { ...n.data, scale_frame: 80 } } : n) } as never)
  useCanvasStore.setState({ analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    serverGraphIdentity: null, lastAuthoritativeGraph: null, lastServerGraphHash: row.read.graph_hash,
    graphEditedSinceLastRun: false, ceeAnalysisReady: null } as never)
}
function mountedFooter() {
  const s = useCanvasStore.getState()
  const authority = selectAnalysisReadinessAuthority(s.analysisStateV1 ?? null)
  const gate = canRunAnalysis({ graphHealth: null, readiness: null, analysisReadiness: authority,
    hasBlockers: false, nodeCount: s.nodes.length, isRunning: false, analysisHeldOn: null,
    draftStreamPhase: 'idle', readinessStale: false, optionsNeedingValues: [] })
  render(<PanelFooter footer={{ dot: 'success', headline: 'Analysis available', subline: '' }}
    isAnalysing={false} canRun={gate.allowed} blockedReason={gate.reason} blockedListing={gate.blockedListing}
    nothingHasAnswered={readinessNothingHasAnswered(null, authority)}
    runOnRecord={selectRunOnRecord(s.analysisStateV1)} onAnalyse={vi.fn()} />)
  return gate
}
beforeEach(() => {
  __resetBootGraphReadForTest()
  vi.spyOn(logger, 'warn').mockImplementation(() => {})
  vi.spyOn(logger, 'debug').mockImplementation(() => {})
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe.each(rows)('founder cold-reopen $pin', row => {
  beforeEach(() => {
    seed(row)
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => clone(row.read) }) as Response))
  })
  it('RED→GREEN: the captured blocked assessment survives and the mounted footer disables Run with the server reason', async () => {
    expect(row.read.analysis_admission.admitted).toBe(false)
    expect(row.read.analysis_state.readiness.status).toBe('blocked')
    await hydrateCanvasFromServer(row.read.scenario_id)
    const s = useCanvasStore.getState()
    expect(s.analysisStateV1).toEqual(row.read.analysis_state)
    expect(mountedFooter().allowed).toBe(false)
    expect(screen.getByTestId('pre-analysis-v3-analyse')).toBeDisabled()
    expect(screen.getByTestId('pre-analysis-v3-footer')).toHaveTextContent(row.read.analysis_state.readiness.blockers[0].message)
    expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent('Readiness not checked yet')
    expect(screen.getByTestId('pre-analysis-v3-footer')).not.toHaveTextContent('You can still run a first pass')
    if (row.obsoleteFrame) {
      const factor = s.nodes.find(n => n.id === 'founder_poc_testing_time')!
      expect(Object.prototype.hasOwnProperty.call(factor.data, 'scale_frame')).toBe(false)
      expect(factor.data.observedState).toMatchObject({ raw_value: 48, cap: 60, unit: 'hours per week' })
    }
  })
  it('negative: a locally dirty canvas does not adopt the read verdict', async () => {
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    await hydrateCanvasFromServer(row.read.scenario_id)
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
  it('negative: an edit made while the read is in flight keeps its dirty mark and rejects the verdict', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const fetch = vi.fn(async () => { await pending; return { ok: true, status: 200, json: async () => clone(row.read) } as Response })
    vi.stubGlobal('fetch', fetch)
    const hydration = hydrateCanvasFromServer(row.read.scenario_id)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    useCanvasStore.setState({ analysisFreshnessDirty: true } as never)
    release()
    await hydration
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
  it('negative: a newer acknowledged revision supersedes an in-flight old read', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const fetch = vi.fn(async () => { await pending; return { ok: true, status: 200, json: async () => clone(row.read) } as Response })
    vi.stubGlobal('fetch', fetch)
    const hydration = hydrateCanvasFromServer(row.read.scenario_id)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    useCanvasStore.setState({ lastServerGraphHash: 'newer-server-revision' } as never)
    recordRegistrationAcknowledged(row.read.scenario_id)
    release()
    expect(await hydration).toBe('skipped')
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    expect(useCanvasStore.getState().lastServerGraphHash).toBe('newer-server-revision')
  })
  it('negative: a moved revision alone rejects the old verdict even before a boot-slot notification', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const fetch = vi.fn(async () => { await pending; return { ok: true, status: 200, json: async () => clone(row.read) } as Response })
    vi.stubGlobal('fetch', fetch)
    const hydration = hydrateCanvasFromServer(row.read.scenario_id)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    const newerRevision = 'f'.repeat(16)
    useCanvasStore.setState({ lastServerGraphHash: newerRevision } as never)
    release()
    expect(await hydration).toBe('skipped')
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
    expect(useCanvasStore.getState().lastServerGraphHash).toBe(newerRevision)
  })
  it('negative: a concurrent newer read owns the boot slot', async () => {
    let release!: () => void
    const pending = new Promise<void>(resolve => { release = resolve })
    const fetch = vi.fn(async () => { await pending; return { ok: true, status: 200, json: async () => clone(row.read) } as Response })
    vi.stubGlobal('fetch', fetch)
    const hydration = hydrateCanvasFromServer(row.read.scenario_id)
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled())
    beginBootGraphRead(row.read.scenario_id)
    release()
    expect(await hydration).toBe('skipped')
    expect(useCanvasStore.getState().analysisStateV1).toBeNull()
  })
})
