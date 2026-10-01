/**
 * ⭐ A COLD OPEN KEEPS THE RUN'S PARTICIPATION FACT (Panel P2x, #75 5925282823, 1 Oct 2026).
 *
 * CEE #2432 (52f8cd) stores the Run's `option_participation` and returns it on the read as
 * `analysis_option_participation`. Served UI `770393a6`, 52f8cd's guest `5d5fa4b9` (Olumi's "Prioritise angel bridge"
 * left out, `excluded_olumi_proposed`): the read carried the record, yet a fresh browser said "This run has no result for
 * this option". The boot leg built the report through `applyScenarioAnalysisRead` without the record; the provisional
 * path and the turn path both pass it. So only a cold open lost the reason.
 *
 * The read is 52f8cd's served one (`fixtures/served-option-participation-5d5fa4b9.read.json`), through the REAL
 * `useServerGraphHydration` → `hydrateCanvasFromServer`. CLAIM TYPE: jsdom store + the real hook; no model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import served from './fixtures/served-option-participation-5d5fa4b9.read.json'
import { useServerGraphHydration } from '../useServerGraphHydration'
import { useCanvasStore } from '../../store'
import { optionParticipationOf } from '../../state/storedOptionParticipation'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isV5CanonicalAnalysisEnabled: () => true,
}))

const SID = (served as { scenario_id: string }).scenario_id
const LEFT_OUT = 'prioritise_angel_bridge'
const POINTER = 'olumi-canvas-current-scenario-id'
const PRISTINE = useCanvasStore.getState()

function freshBrowser(): void {
  localStorage.removeItem(POINTER)
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({
    currentScenarioId: null, nodes: [], edges: [], goalConstraints: null, lastAuthoritativeGraph: null,
    serverGraphIdentity: null, importPendingServerRegistration: false, pendingEmittedEdits: 0,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, graphEditedSinceLastRun: false,
    results: { status: 'idle', progress: 0 }, hasCompletedFirstRun: false, v5AnalysisFact: null, runDelta: null,
  } as never)
}

/** The served read, or (CONTRAST) the same read without the participation record and nothing else changed. */
function stubRead(withRecord: boolean) {
  const body = JSON.parse(JSON.stringify(served)) as Record<string, unknown>
  if (!withRecord) delete body.analysis_option_participation
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(body)) }) as unknown as Response))
}

async function coldOpen(withRecord: boolean) {
  freshBrowser()
  stubRead(withRecord)
  renderHook(() => useServerGraphHydration(SID))
  await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
  await waitFor(() => expect(useCanvasStore.getState().results?.status).toBe('complete'))
  return useCanvasStore.getState().results?.report as Parameters<typeof optionParticipationOf>[0]
}

beforeEach(() => undefined)
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('⭐ a fresh browser keeps the Run\'s record of which options it left out', () => {
  it('PRECONDITION: the served read is a current Run that left Olumi\'s option out, and says so', () => {
    expect((served as { analysis_state: { run_state: { kind: string } } }).analysis_state.run_state.kind).toBe('complete_current')
    expect((served as { analysis_option_participation: unknown }).analysis_option_participation)
      .toEqual([{ option_id: LEFT_OUT, state: 'excluded_olumi_proposed' }])
    const compared = (served as { analysis_result: { enrichment: { option_comparison: Array<{ id: string }> } } })
      .analysis_result.enrichment.option_comparison.map((o) => o.id)
    expect(compared).not.toContain(LEFT_OUT)
  })

  it('⭐ the restored report carries the record, so the option says why it was left out', async () => {
    const report = await coldOpen(true)
    expect(optionParticipationOf(report, LEFT_OUT)?.state).toBe('excluded_olumi_proposed')
  })

  it('CONTRAST: the same read without the record restores the Run with no record (the cause-neutral words stand)', async () => {
    const report = await coldOpen(false)
    expect(optionParticipationOf(report, LEFT_OUT)).toBeNull()
  })
})
