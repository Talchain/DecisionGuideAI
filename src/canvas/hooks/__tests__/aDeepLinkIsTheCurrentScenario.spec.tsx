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
import {
  claimColdLoadDeepLink,
  keyedAutosaveSlot,
  MAIN_AUTOSAVE_SLOT,
  __resetColdLoadDeepLinkForTests,
} from '../../hydrate/coldLoadDeepLink'
import * as scenarios from '../../store/scenarios'
import { projectAutosaveData, autosaveSourceFromStore } from '../../store/autosaveProjection'
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

/** The store as a fresh tab boots it, so no queue a previous row's real writer filled (e.g. `addNode`'s structural add) leaks. */
const PRISTINE = useCanvasStore.getState()

function freshBrowser(over: Record<string, unknown> = {}): void {
  localStorage.removeItem(POINTER)
  localStorage.removeItem(MAIN_AUTOSAVE_SLOT)
  for (const id of [SID, OTHER]) localStorage.removeItem(keyedAutosaveSlot(id))
  __resetColdLoadDeepLinkForTests()
  useCanvasStore.setState(PRISTINE, true)
  useCanvasStore.setState({
    currentScenarioId: null, nodes: [], edges: [], goalConstraints: null, lastAuthoritativeGraph: null,
    serverGraphIdentity: null, importPendingServerRegistration: false, pendingEmittedEdits: 0,
    analysisStateV1: null, analysisFreshness: null, analysisFreshnessDirty: false, graphEditedSinceLastRun: false,
    results: { status: 'idle', progress: 0 }, hasCompletedFirstRun: false, v5AnalysisFact: null, runDelta: null,
    ...over,
  } as never)
}

/**
 * A browser that worked on OTHER in an earlier page: its pointer and its autosave (the REAL writer), and the store as
 * module load seeds it from that pointer. Returns the autosave's bytes.
 */
function rememberOther(): string {
  freshBrowser({ currentScenarioId: OTHER, nodes: [{ id: 'other_goal', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Another decision' } }] })
  scenarios.setCurrentScenarioId(OTHER)
  scenarios.saveAutosave(projectAutosaveData(autosaveSourceFromStore(useCanvasStore.getState())))
  const raw = localStorage.getItem(MAIN_AUTOSAVE_SLOT) as string
  useCanvasStore.setState({ currentScenarioId: scenarios.getCurrentScenarioId(), nodes: [], edges: [] })
  return raw
}
const fetchedIds = () => fetchSpy.mock.calls.map((c) => String(c[0])).map((u) => (u.includes(OTHER) ? OTHER : u.includes(SID) ? SID : u))

/** A different saved scenario whose model shares no element with the linked one (the merge must refuse it). */
const OTHER_READ = {
  ...JSON.parse(JSON.stringify(served)),
  scenario_id: '33333333-4444-4555-8666-777777777777',
  graph: { nodes: [{ id: 'other_goal', kind: 'goal', label: 'Another decision' }], edges: [] },
  graph_identity_hash: { ...(served as { graph_identity_hash: Record<string, unknown> }).graph_identity_hash, value: 'f'.repeat(64) },
  analysis_state: null,
  analysis_result: null,
}
const makeFetch = () => vi.fn(async (url: unknown, _init?: unknown) => ({
  ok: true,
  status: 200,
  json: async () => JSON.parse(JSON.stringify(String(url).includes(OTHER_READ.scenario_id) ? OTHER_READ : served)),
}) as unknown as Response)
const spyWarn = () => vi.spyOn(logger, 'warn')
let fetchSpy: ReturnType<typeof makeFetch>
let warn: ReturnType<typeof spyWarn>
const declines = () => warn.mock.calls.filter((c) => c[0] === 'server_graph_hydration.boot_run_currency_declined').map((c) => c[1] as { unproven?: string | null })

beforeEach(() => {
  fetchSpy = makeFetch()
  vi.stubGlobal('fetch', fetchSpy)
  warn = spyWarn()
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
    // CanvasMVP's order: the cold-load claim, then the hook. Nothing is remembered, so the claim declines (#2383's path).
    expect(claimColdLoadDeepLink(SID)).toBe('declined')
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

  // ⭐ FLIPPED (Canvas, DL 0df0e1, 4 Oct 2026). This row used to say a scenario the browser REMEMBERS (its autosave)
  // still wins over a link. It measured a different object: its store id came from nowhere the browser remembers. The
  // remembered case is below, and there the link now wins (`hydrate/coldLoadDeepLink.ts`).
  it('⭐ a scenario the browser REMEMBERS (pointer + autosave) gives way to a cold-load link: the link is read and adopted, the remembered one never read', async () => {
    const otherRaw = rememberOther()
    expect(useCanvasStore.getState().currentScenarioId, 'precondition: the store seeds the remembered id').toBe(OTHER)
    expect(claimColdLoadDeepLink(SID)).toBe('applied')
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
    expect(fetchedIds()).toEqual([SID])
    expect(localStorage.getItem(POINTER)).toBe(SID)
    expect(localStorage.getItem(keyedAutosaveSlot(OTHER))).toBe(otherRaw)
    expect(declines()).toEqual([])
  })

  it('after a cold-load claim, link to link re-reads the new link, and the write target stays on the model on screen', async () => {
    rememberOther()
    expect(claimColdLoadDeepLink(SID)).toBe('applied')
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), { initialProps: { id: SID } })
    await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
    rerender({ id: OTHER })
    await waitFor(() => expect(fetchedIds()).toEqual([SID, OTHER]))
    await new Promise((r) => setTimeout(r, 20))
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
  })

  it('CONTROL: a scenario the store got IN THIS PAGE (a draft, a turn), with nothing remembered, still wins; the link is not adopted', async () => {
    freshBrowser({ currentScenarioId: OTHER })
    expect(claimColdLoadDeepLink(SID)).toBe('declined')
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect(fetchedIds()).toEqual([OTHER])
    expect(localStorage.getItem(POINTER)).toBeNull()
  })

  it('CONTROL: a link opened LATER in the page (in-app navigation) never supersedes the remembered scenario', async () => {
    rememberOther()
    expect(claimColdLoadDeepLink(undefined)).toBe('declined') // the page's first canvas mount was `/canvas`
    expect(claimColdLoadDeepLink(SID)).toBe('not_first')
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    expect(useCanvasStore.getState().currentScenarioId).toBe(OTHER)
    expect(fetchedIds()).toEqual([OTHER])
    expect(localStorage.getItem(POINTER)).toBe(OTHER)
  })

  it('CONTROL (signed in): the read held for the Supabase load starts ONCE, for the link, never for the remembered id', async () => {
    rememberOther()
    expect(claimColdLoadDeepLink(SID)).toBe('applied')
    const { rerender } = renderHook(({ enabled }) => useServerGraphHydration(SID, { enabled }), { initialProps: { enabled: false } })
    await new Promise((r) => setTimeout(r, 20))
    expect(fetchSpy).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
    expect(fetchedIds()).toEqual([SID])
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
  })

  it('CONTROL: an unsaved local DRAFT (nodes on the canvas, no id) is never retargeted at the link (CODEX UI BUDDY 5923937552)', async () => {
    freshBrowser()
    // The REAL writer a guest's own canvas edit goes through, as the buddy's negative used.
    useCanvasStore.getState().addNode(undefined, 'goal', 'My own draft')
    const draftIds = useCanvasStore.getState().nodes.map((n) => n.id)
    expect(draftIds, 'precondition: the draft has a node and no scenario').toHaveLength(1)
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(claimColdLoadDeepLink(SID)).toBe('declined')
    renderHook(() => useServerGraphHydration(SID))
    await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
    await new Promise((r) => setTimeout(r, 20))
    // The link is read (zero overlap → refused); the draft stays on screen AND keeps today's target (no id).
    expect(useCanvasStore.getState().nodes.map((n) => n.id)).toEqual(draftIds)
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
  })

  it('CONTROL: an id CEE cannot address is never adopted', async () => {
    freshBrowser()
    expect(claimColdLoadDeepLink('local-draft-1')).toBe('declined')
    renderHook(() => useServerGraphHydration('local-draft-1'))
    await new Promise((r) => setTimeout(r, 20))
    expect(useCanvasStore.getState().currentScenarioId).toBeNull()
    expect(localStorage.getItem(POINTER)).toBeNull()
  })

  it('link to link (/scenario/A → /scenario/B, A loaded): B is re-read, and the write target never moves to a model not on screen (CODEX UI BUDDY 5923784243)', async () => {
    freshBrowser()
    const { rerender } = renderHook(({ id }) => useServerGraphHydration(id), { initialProps: { id: SID } })
    await waitFor(() => expect(useCanvasStore.getState().analysisStateV1?.run_state.kind).toBe('complete_current'))
    const onScreen = useCanvasStore.getState().nodes.map((n) => n.id).sort()
    rerender({ id: OTHER })
    // B IS re-read (the DL's "A → B re-reads")…
    await waitFor(() => expect(fetchSpy.mock.calls.some((c) => String(c[0]).includes(OTHER))).toBe(true))
    await new Promise((r) => setTimeout(r, 20))
    // …its zero-overlap merge is refused, so A stays on screen, and A is still where the next turn goes.
    expect(useCanvasStore.getState().nodes.map((n) => n.id).sort()).toEqual(onScreen)
    expect(useCanvasStore.getState().currentScenarioId).toBe(SID)
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
