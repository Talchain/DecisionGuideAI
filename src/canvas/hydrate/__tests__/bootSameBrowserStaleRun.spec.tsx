/**
 * ⛔ AIQ PRE-SHARE HOLD (#75 5903405445; R3 repro 5903397606; DL lease 5903425676): a SAME-BROWSER reload after a
 * newer Run showed the autosaved Run 1 as "Cannot confirm whether this analysis is current" while the server KNOWS it is
 * out of date (`complete_stale` / `graph_changed`, result absent). A fresh browser was right. The server's stale verdict
 * must outrank the autosaved Run: both browsers land on the same surface.
 *
 * Fixtures are R3's served captures (scenario `6b2b94dd`, CEE `27f235b`): the cold read and Run 1's analysis block.
 * CLAIM TYPE: jsdom store + the real hydration path + the served read. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

import served from './fixtures/served-6b2b94dd-stale.read.json'
import run1Block from './fixtures/served-6b2b94dd-run1.block.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer, heldRunIsNotCurrentPerRead } from '../serverGraphHydration'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import { composeAnalysisState } from '../../state/analysisStateSelector'
import { selectHasRenderableAnalysisResult } from '../../ui/inspector-v2/useAnalysisResults'

const SCN = (served as { scenario_id: string }).scenario_id
const run1 = mapV5AnalysisToReport(run1Block as unknown as AnalysisResultBlock)

function browser(held: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCN, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false, v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null },
    ...held,
  } as never)
}
/** What the autosave restores in the browser that ran Run 1: its report, its fresh verdict, a completed run. */
const SAME_BROWSER = {
  results: { status: 'complete', report: run1, hash: run1.model_card.response_hash },
  hasCompletedFirstRun: true,
  analysisFreshness: { freshness: 'fresh', currentGraphHash: 'aaaaaaaaaaaaaaaa', graphHashAtRun: 'aaaaaaaaaaaaaaaa', computedAt: '2026-09-30T03:05:00.000Z' },
}

function semantic(): string {
  const s = useCanvasStore.getState() as unknown as Record<string, any>
  return composeAnalysisState({
    analysisState: s.analysisStateV1, freshness: s.analysisFreshness, dirty: s.analysisFreshnessDirty, source: undefined,
    resultsStatus: s.results?.status, resultsStartedAt: s.results?.startedAt, importHold: s.importPendingServerRegistration,
    hasReport: s.results?.report != null, hasCompletedFirstRun: s.hasCompletedFirstRun,
    hasRenderableResult: selectHasRenderableAnalysisResult(s as never), ceeAnalysisReadyStatus: s.ceeAnalysisReady?.status,
    aiPanelV2On: true,
  } as never).semantic
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(served)) }) as unknown as Response))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('⛔ a same-browser reload after a newer Run: the server\'s stale verdict outranks the autosaved Run', () => {
  it('POSITIVE CONTROL: the served read is complete_stale with no result', () => {
    const r = served as { analysis_state: { run_state: { kind: string } }; analysis_result: unknown }
    expect(r.analysis_state.run_state.kind).toBe('complete_stale')
    expect(r.analysis_result).toBeNull()
  })

  it('the fresh browser (the reference surface): the stale verdict is held and the state says "changed"', async () => {
    browser()
    await hydrateCanvasFromServer(SCN)
    const s = useCanvasStore.getState() as unknown as { analysisStateV1: { run_state: { kind: string } } | null }
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_stale')
    expect(semantic()).toBe('changed')
  })

  it('RED: the SAME browser (Run 1 autosaved) lands on the same "changed" state, never "cannot confirm"', async () => {
    browser(SAME_BROWSER)
    await hydrateCanvasFromServer(SCN)
    const s = useCanvasStore.getState() as unknown as { analysisStateV1: { run_state: { kind: string } } | null; results: { report: unknown } }
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_stale')
    expect(semantic()).toBe('changed')
    // No Run-1 figures, and nothing re-described against today's option list: the held report is gone, as in a fresh browser.
    expect(s.results.report ?? null).toBeNull()
  })

  it('the predicate: only a read that says the held Run cannot be current drops it', () => {
    const v = (kind: string, rr?: boolean) => ({ run_state: { kind }, ...(rr === undefined ? {} : { requires_rerun: rr }) }) as never
    expect(heldRunIsNotCurrentPerRead(v('complete_stale'), null)).toBe(true)
    expect(heldRunIsNotCurrentPerRead(v('complete_current'), null)).toBe(true) // P0 C2: current with no result
    expect(heldRunIsNotCurrentPerRead(v('needs_user_input', true), null)).toBe(true)
    expect(heldRunIsNotCurrentPerRead(v('complete_current'), { type: 'analysis_result' })).toBe(false) // ships its own Run
    expect(heldRunIsNotCurrentPerRead(v('running'), null)).toBe(false)
    expect(heldRunIsNotCurrentPerRead(null, null)).toBe(false) // an older CEE says nothing: keep what we hold
  })
})
