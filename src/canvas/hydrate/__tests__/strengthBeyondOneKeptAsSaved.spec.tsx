/**
 * ⭐ A SAVED STRENGTH BEYOND ONE IS KEPT AS SAVED (DL, 24 Oct 2026; HIGH, wrong number and wrong sign).
 *
 * Measured on staging 001d4133: Paul's legacy funding board (8120fd61) holds link strengths 1.28, 1.92 and −4. The
 * inbound mapper capped a magnitude at 2 (`applyDraftResult.ts`, so −4 landed as 2), and the registration projection
 * capped the weight at 2 and the mean at [−1, +1] (`buildRegistrationGraph.ts`), so the canvas projected 1, 1 and −1.
 * That projection is the reload's proof that the canvas equals the read, so the saved Run was declined
 * (`canvas_not_proven_equal`), and it is the payload every registration sends: an export imported into an empty
 * scenario registered 1, 1 and −1 over the figures the person had. The canvas file contract (`EdgeDataSchema.weight`,
 * max 2) then refused to re-import the board once −4 was kept, so it now carries any magnitude (never a negative one).
 *
 * Real path: CEE's served read of that board → the real boot read (`hydrateCanvasFromServer`) onto an empty canvas bound
 * to the scenario (as a signed-in open leaves it) → the real projection; then the real export → import → registration
 * hook. Stubbed: `fetch` (the read is served from the fixture; a registration is recorded and answered, never sent) and
 * the auth/session readers (a null identity). A magnitude must still be finite and non-negative (Codex r1 on #2973).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, renderHook, waitFor } from '@testing-library/react'

vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
  getUserId: async () => null,
}))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../serverGraphHydration'
import { clearImportRegistrationMarkers } from '../../store/importRegistrationMarker'
import { useDeclinedSavedRunStore } from '../../stores/declinedSavedRunStore'
import { buildRegistrationGraph } from '../../registration/buildRegistrationGraph'
import { useImportRegistration } from '../../registration/useImportRegistration'
import paul from './fixtures/paul-funding-8120fd61-read.json'

type Json = Record<string, any>
const read = paul as Json
const SCENARIO = read.scenario_id as string
const EMPTY_SCENARIO = '0f0f0f0f-1111-4222-8333-444444444444'
/** The three links beyond one, by their ends (an edge's identity on both sides), with what CEE holds. */
const SAVED = [
  { from: 'angels__on', to: 'overhead', mean: 1.28, direction: 'positive' },
  { from: 'customers__on', to: 'overhead', mean: 1.92, direction: 'positive' },
  { from: 'cash_exhaustion', to: 'funding', mean: -4, direction: 'negative' },
] as const

const registers: { url: string; method: string | undefined; body: Json }[] = []
beforeEach(() => {
  localStorage.clear()
  clearImportRegistrationMarkers()
  registers.length = 0
  useDeclinedSavedRunStore.getState().clear()
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(typeof input === 'string' || input instanceof URL ? input : input.url)
    if (/\/graph\/register$/.test(url)) {
      registers.push({ url, method: init?.method, body: JSON.parse(String(init?.body ?? 'null')) })
      return new Response(JSON.stringify({ schema: 'error.v1', details: { code: 'GRAPH_MOVED' } }), { status: 409 })
    }
    if (url.includes(EMPTY_SCENARIO)) {
      return new Response(JSON.stringify({ schema: 'scenario_graph.v1', scenario_id: EMPTY_SCENARIO, graph: null, graph_present: false }), { status: 200 })
    }
    if (/\/scenarios\/[^/]+\/graph$/.test(url)) return new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })
    return new Response('{}', { status: 404 })
  }))
  // As a signed-in open leaves it: the canvas cleared and bound to the scenario, to be filled from CEE's read.
  useCanvasStore.setState({ nodes: [], edges: [], currentScenarioId: SCENARIO, importPendingServerRegistration: false,
    lastAuthoritativeGraph: null, serverGraphIdentity: null, pendingEmittedEdits: 0, history: { past: [], future: [] } } as never)
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

const canvasEdge = (from: string, to: string) => (useCanvasStore.getState().edges as Json[]).find((e) => e.source === from && e.target === to)
const wireEdge = (graph: Json | undefined, from: string, to: string) => (graph?.edges as Json[] | undefined)?.find((e) => e.from === from && e.to === to)

describe('a saved strength beyond one survives the reload, the projection and the file', () => {
  it('hydrate → canvas → projection keeps 1.28, 1.92 and −4 with their signs, and the saved Run is not declined', async () => {
    expect(read.analysis_state.run_state.kind).toBe('complete_current')
    for (const s of SAVED) expect(wireEdge(read.graph, s.from, s.to)?.strength.mean).toBe(s.mean)

    await hydrateCanvasFromServer(SCENARIO)
    // The projection is the reload's proof: equal to the read, so the saved Run is restored, not declined.
    expect(useDeclinedSavedRunStore.getState().declined).toBeNull()
    expect(useCanvasStore.getState().analysisFreshness?.freshnessReason).toBe('boot_read_run_current')

    const st = useCanvasStore.getState()
    const projected = buildRegistrationGraph(st.nodes as never, st.edges as never)
    expect(projected.ok).toBe(true)
    for (const s of SAVED) {
      const edge = canvasEdge(s.from, s.to)
      expect(edge?.data?.weight, `${s.from}→${s.to} on the canvas`).toBe(Math.abs(s.mean))
      expect(edge?.data?.direction).toBe(s.direction)
      const wire = wireEdge(projected.ok ? projected.graph : undefined, s.from, s.to)
      expect(wire?.strength.mean, `${s.from}→${s.to} projected`).toBe(s.mean)
      expect(wire?.effect_direction).toBe(s.direction)
    }
  })

  it('export → import into an empty scenario: imported, −4 kept as weight 4 and negative, and the registration sends 1.28, 1.92 and −4', async () => {
    await hydrateCanvasFromServer(SCENARIO)
    const file = useCanvasStore.getState().exportCanvas()
    const filed = (JSON.parse(file).edges as Json[]).find((e) => e.source === 'cash_exhaustion' && e.target === 'funding')
    expect(filed?.data).toMatchObject({ weight: 4, direction: 'negative' })

    useCanvasStore.setState({ currentScenarioId: EMPTY_SCENARIO } as never)
    expect(useCanvasStore.getState().importCanvas(file)).toBe(true)
    expect(canvasEdge('cash_exhaustion', 'funding')?.data).toMatchObject({ weight: 4, direction: 'negative' })

    renderHook(() => useImportRegistration())
    await waitFor(() => expect(registers).toHaveLength(1))
    expect(registers[0].url).toBe(`/bff/cee/scenarios/${EMPTY_SCENARIO}/graph/register`)
    expect(registers[0].method).toBe('POST')
    for (const s of SAVED) {
      const wire = wireEdge(registers[0].body.graph, s.from, s.to)
      expect(wire?.strength.mean, `${s.from}→${s.to} registered`).toBe(s.mean)
      expect(wire?.effect_direction).toBe(s.direction)
    }
  })

  it.each([
    ['−1 (a magnitude is never negative; the sign is the direction)', '-1'],
    ['1e309 (never Infinity, which would register as null)', '1e309'],
  ])('NEGATIVE: a file holding weight %s is refused, and nothing is registered', async (_name, literal) => {
    await hydrateCanvasFromServer(SCENARIO)
    const file = JSON.parse(useCanvasStore.getState().exportCanvas()) as Json
    const edge = (file.edges as Json[]).find((e) => e.source === 'cash_exhaustion' && e.target === 'funding')!
    edge.data = { ...edge.data, weight: '__WEIGHT__' }
    // Spliced as a JSON literal: `1e309` is valid JSON and parses to Infinity.
    const text = JSON.stringify(file).replace('"__WEIGHT__"', literal)
    useCanvasStore.setState({ currentScenarioId: EMPTY_SCENARIO } as never)
    expect(useCanvasStore.getState().importCanvas(text)).toBe(false)
    // Refused: the canvas still holds the board as read (4, negative), and no registration is armed or sent.
    expect(canvasEdge('cash_exhaustion', 'funding')?.data).toMatchObject({ weight: 4, direction: 'negative' })
    expect(useCanvasStore.getState().importPendingServerRegistration).toBe(false)
    renderHook(() => useImportRegistration())
    await new Promise((r) => setTimeout(r, 100))
    expect(registers).toHaveLength(0)
  })
})
