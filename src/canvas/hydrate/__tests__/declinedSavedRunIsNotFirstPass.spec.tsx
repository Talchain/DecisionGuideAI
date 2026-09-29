/**
 * ⭐ A SAVED RUN THE BOOT CANNOT CONFIRM IS NEVER DESCRIBED AS "NO RUN" — replayed from two SERVED reads.
 *
 * Served on `eb5e9781`: a fresh browser opening saved Run `c96fc4bb` got "Analysis available · Analyse first pass",
 * although the read carried a `complete_current` Run. The boot rightly declined to RESTORE it (the stored edge
 * strength 4.61 is outside the published [-1, 1]; the canvas holds 1, so the canvas is not proven equal — Canvas #72
 * 5893089961, AIQ 5893355501). P0 Shared Data asked Canvas to "explain the incompatibility rather than imply no first
 * Run" (#72 5893379882). The fixtures are those reads, byte for byte (`served-c96fc4bb-eb5e9781.read.json` declines;
 * `served-0c238873-7f1be5d8.read.json` adopts, the control).
 *
 * CLAIM TYPE: jsdom store + the real hydration path + the served reads; then the footer the dock mounts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import declinedRead from './fixtures/served-c96fc4bb-eb5e9781.read.json'
import adoptedRead from './fixtures/served-0c238873-7f1be5d8.read.json'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { useDeclinedSavedRunStore, selectSavedRunUnconfirmed } from '../../stores/declinedSavedRunStore'
import { deriveReadinessDisplay } from '../../components/pre-analysis-v3/footer/readinessDisplay'
import { PanelFooter } from '../../components/pre-analysis-v3/footer/PanelFooter'
import { FOOTER_COPY } from '../../components/pre-analysis-v3/constants'

function freshBrowser(scenarioId: string) {
  useCanvasStore.setState({
    currentScenarioId: scenarioId, nodes: [], edges: [], lastAuthoritativeGraph: null, serverGraphIdentity: null,
    importPendingServerRegistration: false, pendingEmittedEdits: 0, ceeAnalysisReady: null, lastServerGraphHash: null,
    bootAdmittedRevision: null, analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false,
    graphEditedSinceLastRun: false, v5AnalysisFact: null, hasCompletedFirstRun: false,
    results: { status: 'idle', report: null },
  } as never)
  useDeclinedSavedRunStore.getState().clear()
}

function serve(read: unknown) {
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(read)) }) as unknown as Response))
}

const DECLINED_ID = (declinedRead as { scenario_id: string }).scenario_id
const ADOPTED_ID = (adoptedRead as { scenario_id: string }).scenario_id

beforeEach(() => cleanup())
afterEach(() => { vi.unstubAllGlobals(); cleanup() })

describe('the boot records a saved Run it cannot confirm, and writes no verdict', () => {
  it('c96fc4bb (served): the Run is recorded as existing, NOT restored', async () => {
    freshBrowser(DECLINED_ID)
    serve(declinedRead)
    await hydrateCanvasFromServer(DECLINED_ID)
    expect(useDeclinedSavedRunStore.getState().declined).toEqual({
      scenarioId: DECLINED_ID, runStateKind: 'complete_current', reason: 'canvas_not_proven_equal',
    })
    // Still no verdict: the record changes words, never the truth the boot declined to assert.
    expect((useCanvasStore.getState() as unknown as { analysisStateV1: unknown }).analysisStateV1).toBeNull()
  })

  it('CONTROL 0c238873 (served, adopts): nothing is recorded, and an earlier record is cleared', async () => {
    freshBrowser(ADOPTED_ID)
    useDeclinedSavedRunStore.getState().record({ scenarioId: 'stale', runStateKind: 'complete_current', reason: 'x' })
    serve(adoptedRead)
    await hydrateCanvasFromServer(ADOPTED_ID)
    expect(useDeclinedSavedRunStore.getState().declined).toBeNull()
  })
})

describe('selectSavedRunUnconfirmed', () => {
  const d = { scenarioId: 'a', runStateKind: 'complete_current' as const, reason: 'canvas_not_proven_equal' }
  it('true for the scenario on screen with no local Run', () => expect(selectSavedRunUnconfirmed(d, 'a', false)).toBe(true))
  it('false for another scenario', () => expect(selectSavedRunUnconfirmed(d, 'b', false)).toBe(false))
  it('false once this browser holds a Run of its own', () => expect(selectSavedRunUnconfirmed(d, 'a', true)).toBe(false))
})

describe('the Run control never says "first pass" over a saved Run', () => {
  const resting = { dot: 'success' as const, headline: FOOTER_COPY.ready, subline: FOOTER_COPY.readySubEstimates }

  it('the ready arm says the saved Run exists and why it is not shown', () => {
    const shown = deriveReadinessDisplay({ readinessCheck: null, isAnalysing: false, canRun: true, nothingHasAnswered: false, resting, savedRunUnconfirmed: true })
    expect(shown.subline).toBe(FOOTER_COPY.savedRunUnconfirmedSub)
  })

  it('CONTROL: a blocked model keeps its blocker, not this sentence', () => {
    const shown = deriveReadinessDisplay({ readinessCheck: null, isAnalysing: false, canRun: false, blockedReason: 'Add a goal', nothingHasAnswered: false, resting, savedRunUnconfirmed: true })
    expect(shown.subline).not.toBe(FOOTER_COPY.savedRunUnconfirmedSub)
  })

  it('the footer offers "Re-run analysis" and the sentence, never "Analyse first pass"', () => {
    render(<PanelFooter footer={resting} onAnalyse={() => {}} isAnalysing={false} canRun runOnRecord savedRunUnconfirmed />)
    expect(screen.getByRole('button', { name: FOOTER_COPY.reanalyse })).toBeDefined()
    expect(screen.queryByText(FOOTER_COPY.analyse)).toBeNull()
    expect(screen.getByTestId('pre-analysis-v3-footer-subline').textContent).toBe(FOOTER_COPY.savedRunUnconfirmedSub)
  })
})
