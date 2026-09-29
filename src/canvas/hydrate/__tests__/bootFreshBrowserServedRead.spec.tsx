/**
 * ⭐ A FRESH BROWSER SEES THE STORED RUN — replayed from the SERVED read, from an EMPTY canvas.
 *
 * #2308's rows seeded the canvas with the read's graph before booting, so the merge changed nothing and the boot
 * restored the Run. A real fresh browser starts EMPTY: the merge adopts the server's model, the merge marked that as an
 * edit, and the boot declined the server's own `complete_current` Run as `edited_since_read` — measured on served
 * `7f1be5d8` (scenario `0c238873`: the Analysis tab read "Analyse first pass") and reproduced by replaying that exact
 * read through the boot path. The fixture is that read, byte for byte (`served-0c238873-7f1be5d8.read.json`).
 *
 * CLAIM TYPE: jsdom store + the real hydration path + the served read. No model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import served from './fixtures/served-0c238873-7f1be5d8.read.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { mapV5AnalysisToReport } from '../../../v5/mapV5AnalysisToReport'
import type { AnalysisResultBlock } from '@talchain/schemas/boundary'

const SCN = (served as { scenario_id: string }).scenario_id
const readHash = mapV5AnalysisToReport((served as { analysis_result: unknown }).analysis_result as AnalysisResultBlock).model_card.response_hash

/** A browser that has never opened this scenario: nothing held at all. */
function freshBrowser(held: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCN, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false, v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null },
    ...held,
  } as never)
}

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(served)) }) as unknown as Response))
})
afterEach(() => { vi.unstubAllGlobals() })

describe('⭐ a fresh browser, the served read', () => {
  it('adopting the server model is not an edit: the Run is current and its report is the READ\'s', async () => {
    freshBrowser()
    await hydrateCanvasFromServer(SCN)
    const s = useCanvasStore.getState() as unknown as { nodes: unknown[]; analysisFreshnessDirty: boolean; analysisStateV1: { run_state: { kind: string } } | null; results: { status: string; hash?: string } }
    expect(s.nodes.length).toBe(10)
    expect(s.analysisFreshnessDirty).toBe(false)
    expect(s.analysisStateV1?.run_state.kind).toBe('complete_current')
    expect(s.results.status).toBe('complete')
    expect(s.results.hash).toBe(readHash)
  })

  it('CONTROL: a browser that HOLDS a result keeps the edit mark on a merge that changes its canvas (unchanged rule)', async () => {
    const other = mapV5AnalysisToReport({ type: 'analysis_result', summary: 'held elsewhere', leading_option_id: null, enrichment: {} } as unknown as AnalysisResultBlock)
    freshBrowser({ results: { status: 'complete', report: other, hash: other.model_card.response_hash } })
    await hydrateCanvasFromServer(SCN)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
    expect((useCanvasStore.getState() as unknown as { analysisStateV1: { run_state: { kind: string } } | null }).analysisStateV1?.run_state.kind).not.toBe('complete_current')
  })

  it('CONTROL: a browser that holds a verdict keeps the edit mark too', async () => {
    freshBrowser({ analysisFreshness: { freshness: 'fresh', currentGraphHash: 'ffffffffffffffff', graphHashAtRun: 'ffffffffffffffff', computedAt: '2026-09-28T00:00:00.000Z' } })
    await hydrateCanvasFromServer(SCN)
    expect(useCanvasStore.getState().analysisFreshnessDirty).toBe(true)
  })
})
