/**
 * ⭐ A DEEP LINK IS THE SCENARIO ON SCREEN, SO IT IS THE CURRENT SCENARIO (Panel, DL #75 5923453115).
 *
 * CODEX UI BUDDY (5923448472), served UI `b0d5ea2d`, a fresh guest on `#/scenario/2d5982b5…` (R3's saved funding
 * model, `complete_current`, result present): the read merged the model onto the canvas, then the boot proof declined
 * the saved Run as `canvas_not_proven_equal` / `scenario_not_current`, and Reasoning said "No analysis has run yet".
 * Re-measured by Panel on `69c05df1`: `currentScenarioId` stays null for the whole session, so every turn also went out
 * with `scenarioId: null`.
 *
 * The read is the buddy's own capture of that cold open (`fixtures/served-deep-link-2d5982b5-b0d5ea2d.read.json`),
 * through the REAL `hydrateCanvasFromServer`. CLAIM TYPE: jsdom store + the real hook and hydration; no model calls.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'

import served from './fixtures/served-deep-link-2d5982b5-b0d5ea2d.read.json'
import { useServerGraphHydration } from '../useServerGraphHydration'
import { useCanvasStore } from '../../store'
import { logger } from '../../../lib/logger'
import { buildV5Payload } from '../../../v5/buildPayload'
import { isUUID } from '../../../services/turn-request-builder'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

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
const OTHER = '33333333-4444-4555-8666-777777777777'
const POINTER = 'olumi-canvas-current-scenario-id'

function freshBrowser(over: Record<string, unknown> = {}): void {
  localStorage.removeItem(POINTER)
  useCanvasStore.setState({
    currentScenarioId: null, nodes: [], edges: [], goalConstraints: null, lastAuthoritativeGraph: null,
    serverGraphIdentity: null, importPendingServerRegistration: false, pendingEmittedEdits: 0,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, graphEditedSinceLastRun: false,
    results: { status: 'idle', progress: 0 }, hasCompletedFirstRun: false, v5AnalysisFact: null, runDelta: null,
    ...over,
  } as never)
}

let fetchSpy: ReturnType<typeof vi.fn>
let warn: ReturnType<typeof vi.spyOn>
const declines = () => warn.mock.calls.filter((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined').map((c) => c[1] as { unproven?: string | null })

beforeEach(() => {
  fetchSpy = vi.fn(async () => ({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(served)) }) as unknown as Response)
  vi.stubGlobal('fetch', fetchSpy)
  warn = vi.spyOn(logger, 'warn')
})
afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('⭐ a fresh deep link binds the scenario it opens', () => {
  it('PRECONDITION: the served read is the saved current Run of the linked scenario', () => {
    expect(SID).toBe('2d5982b5-69c7-4976-a985-e7501bb39c26')
    expect((served as { analysis_state: { run_state: { kind: string } } }).analysis_state.run_state.kind).toBe('complete_current')
    expect((served as { analysis_result: unknown }).analysis_result).not.toBeNull()
  })

  it('⭐ the route id becomes the current scenario, and the saved Run is restored, not declined', async () => {
    freshBrowser()
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
    const st = useCanvasStore.getState()
    expect(st.currentScenarioId).toBe(SID)
    // The pointer is NOT written: it would seed the next session's store and make a later link to another scenario
    // lose to this one.
    expect(localStorage.getItem(POINTER)).toBeNull()
    expect(st.results?.hash ?? null).not.toBeNull()
    expect(declines()).toEqual([])
  })

  it('CONTROL: a scenario the store already holds (autosave / draft) still wins; the link is only read, never adopted', async () => {
    freshBrowser({ currentScenarioId: OTHER })
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect(localStorage.getItem(POINTER)).toBeNull()
  })

  it('CONTROL: an id CEE cannot address is never adopted', async () => {
    freshBrowser()
    renderHook(() => useServerGraphHydration('local-draft-1'))
    await new Promise((r) => setTimeout(r, 20))
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(localStorage.getItem(POINTER)).toBeNull()
  })

  it('a link-to-link navigation (/scenario/A → /scenario/B) follows the link it adopted', async () => {
    freshBrowser()
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), { initialProps: { id: OTHER } })
    await waitFor(() => expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER))
    rerender({ id: SID })
    await waitFor(() => expect(useCanvasStore.getState().currentScenarioId).toBe(SID))
    await waitFor(() => expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes(SID))).toBe(true))
  })

  it('⭐ DL row: the next turn goes to the scenario on screen — the dispatch\'s own inputs (store id, `isUUID` mint guard, the real payload builder)', async () => {
    freshBrowser()
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(useCanvasStore.getState().currentScenarioId).toBe(SID))
    // `sendTurn` reads `currentScenarioId` and MINTS a new UUID only when it is null or not a UUID
    // (`useConversation.ts`, "lazy UUID allocation"). Before this fix it was null here, so the first Send minted one.
    const atDispatch = useCanvasStore.getState().currentScenarioId
    expect(isUUID(atDispatch)).toBe(true)
    const built = buildV5Payload({ scenarioId: atDispatch as string, turnId: 't1', stage: 'frame', turnClass: 'frame', mode: 'user', message: 'hello' })
    if (!built.ok) throw new Error('payload did not build')
    expect((built.payload as unknown as { scenario_id: string }).scenario_id).toBe(SID)
  })
})

describe('CONTROL (DL condition): share and read-only routes are exactly as today', () => {
  const src = (p: string) => readFileSync(join(process.cwd(), 'src', p), 'utf8')
  it('the hook runs only inside CanvasMVP, which mounts only on /scenario/:id and /canvas — never on /share, /panel or /scenario/:id/panel', () => {
    const app = src('poc/AppPoC.tsx')
    const canvasMounts = [...app.matchAll(/<Route path="([^"]+)" element={<RouteContent><CanvasMVP \/>/g)].map((m) => m[1]).sort()
    expect(canvasMounts).toEqual(['/canvas', '/scenario/:id'])
    expect(src('routes/ShareView.tsx')).not.toMatch(/useServerGraphHydration|CanvasMVP/)
    expect(app).toMatch(/<Route path="\/scenario\/:id\/panel" element={<PanelSetupPage \/>/)
    expect(app).toMatch(/<Route path="\/panel\/:round_id" element={<ParticipantPacketPage \/>/)
  })
})
