/**
 * THE BOOT RACE (DL 380e54 #85 5937384802; repro CANVAS 5937336419, amended 5937354495).
 *
 * Rows:
 *   B1  the gate's table: auth loading holds the read; a guest reads once auth resolves; a signed-in open waits for the
 *       Supabase load of THIS route id to settle; a settle for another id does not count.
 *   B2  (DL row 1) auth that never resolves: the read proceeds after AUTH_WAIT_BOUND_MS, so the canvas never stays blank.
 *   B3  the hydration hook does not attempt the CEE read while disabled, attempts it once when enabled, and only once.
 *   B4  the two orders on the REAL store: Supabase hydrate → CEE identity survives (the order the gate enforces);
 *       CEE identity → Supabase hydrate wipes it (the order the gate prevents). The second row is the defect, pinned so
 *       a future "fix" that changes DECISION_CONTEXT_CLEAR instead is a visible decision.
 *   B5  CanvasMVP wires it: the Supabase load settles in `finally` (a failed load still releases the read) and the
 *       hydration hook receives `enabled` and `readEpoch`. Bound by the file's bytes.
 *   B6  ROUND 2 (DL ruling #2422 5939155228), each a DEFERRED-PROMISE row on the REAL store through a harness that
 *       mirrors CanvasMVP (load tracker → gate → hydration hook). ROUND 3 (CODEX OVERFLOW @0cd24c51, DL: ACCOUNTS takes
 *       it): every read is the REAL `hydrateCanvasFromServer` on a served capture, only `fetch` replaced and its answers
 *       held; the Supabase copy shares the capture's element ids (compatible identities); every row asserts the END
 *       state (nodes, lastAuthoritativeGraph, serverGraphIdentity, runDelta) and the exact read count:
 *       (1) LATE AUTH (CODEX UI BUDDY 5939083741): auth after the bound → the guest-path read → the signed-in load wipes
 *           it → its settle (success OR failure) grants exactly ONE more read → restored; never a third.
 *       (2) HUNG LOAD: the wait releases at SUPABASE_LOAD_WAIT_BOUND_MS (not before); the late load wipes the graph →
 *           its settle grants exactly ONE more read (the fence) → restored.
 *       (3) A→B→A: the ORIGINAL A load stays pending and settles during pending B, or during the fresh A: neither gate
 *           changes; B's late settle changes nothing; only the fresh A's settle reads A, once.
 *       ONCE PER EPOCH: a dependency change with no new epoch reads nothing. CONTROLS (the buddy's): auth resolved
 *       before the bound reads once, after the load; auth that never resolves reads once and keeps CEE's view.
 */
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const auth = vi.hoisted(() => ({ state: { loading: false, user: null as null | { id: string } } }))
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: () => auth.state }))
vi.mock('../../../lib/supabase', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../lib/supabase')>()),
  getSessionIdentity: async () => ({ userId: null, accessToken: null }),
}))
const hydrate = vi.hoisted(() => ({ fn: vi.fn(async () => 'merged') }))
vi.mock('../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../flags')>()),
  isV5CanonicalAnalysisEnabled: () => true,
}))
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hydrate/serverGraphHydration')>()),
  hydrateCanvasFromServer: (...args: unknown[]) => hydrate.fn(...(args as [])),
}))

import served from './fixtures/served-deep-link-2d5982b5-b0d5ea2d.read.json'
import { useCanvasStore } from '../../store'
import { wireEdgePairKey } from '../../utils/graphIdentity'
import { useEffect, useRef } from 'react'
import {
  AUTH_WAIT_BOUND_MS,
  SUPABASE_LOAD_WAIT_BOUND_MS,
  bootServerReadEpoch,
  serverReadEnabled,
  useBootServerRead,
  useSupabaseLoadTracker,
  type BootServerReadInputs,
} from '../useBootServerReadEnabled'
import { useServerGraphHydration } from '../useServerGraphHydration'

const ROUTE = '5f0c2a8e-1b7d-4c3e-9a64-0d2b8e7f1c35'

beforeEach(() => {
  auth.state = { loading: false, user: null }
  hydrate.fn.mockClear()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [], serverGraphIdentity: null } as never)
})
afterEach(() => { vi.useRealTimers() })

describe('B1 · the gate', () => {
  const settled = { routeId: ROUTE, gen: 1, settled: true }
  const pending = { routeId: ROUTE, gen: 1, settled: false }
  const base: BootServerReadInputs = {
    authLoading: false, authWaitExpired: false, isPersistenceActive: true, routeId: ROUTE, load: null, loadWaitExpired: false,
  }
  const rows: Array<[string, Partial<BootServerReadInputs>, boolean, string]> = [
    ['auth loading holds every read', { authLoading: true }, false, 'no-supabase-load'],
    ['a guest reads once auth resolves', { isPersistenceActive: false }, true, 'no-supabase-load'],
    ['signed in, the load has not started → wait', {}, false, 'no-supabase-load'],
    ['signed in, the load is in flight → wait', { load: pending }, false, 'supabase-load-pending:1'],
    ['signed in, the load is in flight past the bound → read', { load: pending, loadWaitExpired: true }, true, 'supabase-load-pending:1'],
    ['signed in, the current load settled for ANOTHER route → wait', { load: { ...settled, routeId: 'another-id' } }, false, 'no-supabase-load'],
    ['signed in, the current load settled for THIS route → read', { load: settled }, true, 'after-supabase-load:1'],
    ['signed in with no route id (no Supabase load runs) → read', { routeId: null }, true, 'no-supabase-load'],
  ]
  for (const [name, over, want, epoch] of rows) {
    it(name, () => {
      expect(serverReadEnabled({ ...base, ...over })).toBe(want)
      expect(bootServerReadEpoch({ ...base, ...over })).toBe(epoch)
    })
  }
})

describe('B2 · auth that never resolves (DL row 1)', () => {
  it(`proceeds after ${AUTH_WAIT_BOUND_MS} ms, not before`, () => {
    vi.useFakeTimers()
    auth.state = { loading: true, user: null }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useBootServerRead(ROUTE, false, null).enabled)
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(AUTH_WAIT_BOUND_MS - 1) })
    expect(result.current).toBe(false)
    act(() => { vi.advanceTimersByTime(1) })
    expect(result.current).toBe(true)
  })
})

describe('B3 · the hydration hook honours `enabled`', () => {
  it('no CEE read while disabled; exactly one once enabled', async () => {
    const { rerender } = renderHook(({ enabled }) => useServerGraphHydration(ROUTE, { enabled }), { initialProps: { enabled: false } })
    await act(async () => { await Promise.resolve() })
    expect(hydrate.fn).not.toHaveBeenCalled()
    rerender({ enabled: true })
    await vi.waitFor(() => expect(hydrate.fn).toHaveBeenCalledTimes(1))
    rerender({ enabled: true })
    await act(async () => { await Promise.resolve() })
    expect(hydrate.fn).toHaveBeenCalledTimes(1)
  })
  it('CONTROL: the default (no option) reads at once, as every existing caller expects', async () => {
    renderHook(() => useServerGraphHydration(ROUTE))
    await vi.waitFor(() => expect(hydrate.fn).toHaveBeenCalledTimes(1))
  })
})

describe('B4 · the two orders, on the real store', () => {
  const nodes = [{ id: 'g', type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }] as never
  const identity = { value: 'cee-identity-1', projectionVersion: 'v1' }
  it('Supabase hydrate FIRST, then the CEE identity → it survives (the order the gate enforces)', () => {
    useCanvasStore.getState().hydrateGraphSlice({ nodes, edges: [], currentScenarioId: ROUTE, goalConstraints: null } as never)
    useCanvasStore.getState().setServerGraphIdentity(identity)
    expect(useCanvasStore.getState().serverGraphIdentity).toEqual(identity)
  })
  it('CEE identity FIRST, then the Supabase hydrate → it is wiped (the order the gate PREVENTS)', () => {
    useCanvasStore.setState({ currentScenarioId: ROUTE } as never)
    useCanvasStore.getState().setServerGraphIdentity(identity)
    useCanvasStore.getState().hydrateGraphSlice({ nodes, edges: [], currentScenarioId: ROUTE, goalConstraints: null } as never)
    expect(useCanvasStore.getState().serverGraphIdentity).toBeNull()
  })
})

describe('B5 · CanvasMVP wires the gate', () => {
  const src = readFileSync(resolve(__dirname, '../../../routes/CanvasMVP.tsx'), 'utf8')
  it('every Supabase load goes through the generation tracker (success OR failure settles it)', () => {
    expect(src).toMatch(/const \{ load: supabaseLoad, track: trackSupabaseLoad \} = useSupabaseLoadTracker\(\)/)
    expect(src).toMatch(/trackSupabaseLoad\(\s*id,\s*loadSupabaseScenario\(id\)\.catch\(/)
  })
  it('the hydration hook receives the gate as `enabled` and its `readEpoch`', () => {
    expect(src).toMatch(/useBootServerRead\(scenarioIdFromRoute, isPersistenceActive, supabaseLoad\)/)
    expect(src).toMatch(/useServerGraphHydration\(scenarioIdFromRoute, \{ enabled: bootServerRead\.enabled, readEpoch: bootServerRead\.readEpoch \}\)/)
  })
})

describe('B6 · round 2: one more read per load generation, never a stale one (DL 5939155228; round 3: CODEX OVERFLOW @0cd24c51)', () => {
  // ⭐ REAL HYDRATION, DEFERRED TRANSPORT. Every read below is the REAL `hydrateCanvasFromServer` (merge, identity,
  // run restore) against the buddy's served capture of a saved Run (`served-deep-link-2d5982b5-b0d5ea2d.read.json`);
  // only `fetch` is replaced, and each answer is held until the row releases it. The Supabase copy is the canvas that
  // read leaves (same element ids: COMPATIBLE identities, so the merge is a merge, not a `zeroOverlap` refusal), saved
  // with its own layout and edited labels, so the end state shows which side each half came from.
  const A = (served as { scenario_id: string }).scenario_id
  const B = '7a1d3c5e-2b4f-4d6a-8c9e-1f3b5d7a9c2e'
  const PRISTINE = useCanvasStore.getState()
  const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T
  const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve() }
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  type EndState = {
    scenario: string | null
    nodes: Array<{ id: string; label: unknown; position: unknown }>
    graph: { nodeIds: string[]; edgePairs: string[] } | null
    identity: unknown
    runDelta: unknown
  }
  const endState = (): EndState => {
    const st = useCanvasStore.getState()
    const g = st.lastAuthoritativeGraph
    return {
      scenario: st.currentScenarioId ?? null,
      nodes: st.nodes.map((n) => ({ id: n.id, label: (n.data as { label?: unknown }).label, position: n.position })).sort(byId),
      graph: g ? { nodeIds: [...g.nodeIds].sort(), edgePairs: [...g.edgePairs].sort() } : null,
      identity: st.serverGraphIdentity,
      runDelta: st.runDelta,
    }
  }
  const freshStore = () => {
    useCanvasStore.setState(PRISTINE, true)
    useCanvasStore.setState({
      currentScenarioId: null, nodes: [], edges: [], goalConstraints: null, lastAuthoritativeGraph: null,
      serverGraphIdentity: null, importPendingServerRegistration: false, analysisStateV1: null, analysisFreshness: null,
      analysisFreshnessDirty: false, results: { status: 'idle', progress: 0 }, v5AnalysisFact: null, runDelta: null,
    } as never)
  }

  // The deferred transport: A answers with the capture, anything else is "not readable".
  type Pending = { url: string; release: () => void; released: boolean }
  let fetches: Pending[] = []
  const transport = vi.fn((url: unknown) =>
    new Promise<Response>((res) => {
      const pending: Pending = {
        url: String(url),
        released: false,
        release: () => {
          pending.released = true
          res(String(url).includes(A)
            ? ({ ok: true, status: 200, json: async () => clone(served) } as unknown as Response)
            : ({ ok: false, status: 404, json: async () => ({}) } as unknown as Response))
        },
      }
      fetches.push(pending)
    }))
  const answerReads = async () => { for (const f of fetches) if (!f.released) f.release(); await flush() }
  const transportCallsFor = (id: string) => transport.mock.calls.filter((c) => String(c[0]).includes(id)).length

  // CEE'S VIEW: what one real cold read of the capture leaves on an empty canvas. The SUPABASE COPY: that canvas as the
  // user saved it, with its own layout and labels. OVER_SUPABASE: the designed end state, CEE's values on the Supabase
  // copy's layout ("values from CEE, layout from local"), with CEE's graph, identity and run delta.
  let CEE_VIEW: EndState
  let SUPABASE_COPY: { nodes: unknown[]; edges: unknown[]; goalConstraints: unknown }
  let OVER_SUPABASE: EndState
  type Hydrate = typeof import('../../hydrate/serverGraphHydration')['hydrateCanvasFromServer']
  let realHydrate: Hydrate
  beforeAll(async () => {
    realHydrate = (await vi.importActual<typeof import('../../hydrate/serverGraphHydration')>('../../hydrate/serverGraphHydration')).hydrateCanvasFromServer
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => clone(served) }) as unknown as Response))
    freshStore()
    useCanvasStore.setState({ currentScenarioId: A } as never)
    expect(await realHydrate(A, { userId: null, accessToken: null, includeConversationTurns: true })).toBe('merged')
    CEE_VIEW = endState()
    const st = useCanvasStore.getState()
    SUPABASE_COPY = {
      nodes: clone(st.nodes).map((n, i) => ({ ...n, position: { x: 1000 + i, y: 7 }, data: { ...n.data, label: `${String((n.data as { label?: unknown }).label)} (saved copy)` } })),
      edges: clone(st.edges),
      goalConstraints: st.goalConstraints ?? null,
    }
    OVER_SUPABASE = {
      ...CEE_VIEW,
      nodes: CEE_VIEW.nodes.map((n) => ({ ...n, position: (SUPABASE_COPY.nodes as Array<{ id: string; position: unknown }>).find((s) => s.id === n.id)?.position })),
    }
    vi.unstubAllGlobals()
  })

  it('PRECONDITION: CEE\'s view is the capture\'s, bound by identity (graph ids, identity token, run delta), not by a value', () => {
    const cap = served as unknown as {
      graph: { nodes: Array<{ id: string }>; edges: Array<{ from: string; to: string }> }
      graph_identity_hash: { value: string; projection_version: string }
      current_read: { run_delta: { endpoints: { prior: { run_id: string } } } }
    }
    expect(CEE_VIEW.scenario).toBe(A)
    expect(CEE_VIEW.nodes.map((n) => n.id)).toEqual(cap.graph.nodes.map((n) => n.id).sort())
    expect(CEE_VIEW.graph).toEqual({
      nodeIds: cap.graph.nodes.map((n) => n.id).sort(),
      edgePairs: cap.graph.edges.map((e) => wireEdgePairKey(e) as string).sort(),
    })
    expect(CEE_VIEW.identity).toEqual({ value: cap.graph_identity_hash.value, projectionVersion: cap.graph_identity_hash.projection_version })
    const rd = CEE_VIEW.runDelta as { scenarioId: string; delta: { endpoints: { prior: { run_id: string } } } }
    expect(rd.scenarioId).toBe(A)
    expect(rd.delta.endpoints.prior.run_id).toBe(cap.current_read.run_delta.endpoints.prior.run_id)
    // The copy differs from CEE's view in every label and every position, so the end state names its source.
    expect(OVER_SUPABASE.nodes.every((n, i) => n.label === CEE_VIEW.nodes[i].label && n.position !== CEE_VIEW.nodes[i].position)).toBe(true)
  })

  type Load = { id: string; resolve: (apply: boolean) => void; reject: () => void }
  let loads: Load[] = []
  // The real loadScenario's store effect: `hydrateGraphSlice` with the saved row (which clears the decision context).
  const loadScenario = (id: string) =>
    new Promise<void>((res, rej) => {
      loads.push({
        id,
        resolve: (apply) => {
          if (apply) useCanvasStore.getState().hydrateGraphSlice({ ...clone(SUPABASE_COPY), currentScenarioId: id } as never)
          res()
        },
        reject: () => rej(new Error('load failed')),
      })
    })
  // Mirrors CanvasMVP (B5 binds its bytes): persistence is active once a user is signed in.
  function useHarness(routeId: string) {
    const signedIn = auth.state.user !== null
    const { load, track } = useSupabaseLoadTracker()
    const hydratedRef = useRef<string | null>(null)
    useEffect(() => {
      if (signedIn && hydratedRef.current !== routeId) {
        hydratedRef.current = routeId
        track(routeId, loadScenario(routeId).catch(() => {}))
      }
    }, [routeId, signedIn, track])
    const boot = useBootServerRead(routeId, signedIn, load)
    useServerGraphHydration(routeId, { enabled: boot.enabled, readEpoch: boot.readEpoch })
    return boot
  }
  const reads = () => hydrate.fn.mock.calls.map((c) => (c as unknown[])[0])

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    freshStore()
    loads = []
    fetches = []
    transport.mockClear()
    vi.stubGlobal('fetch', transport)
    hydrate.fn.mockImplementation(((...args: Parameters<Hydrate>) => realHydrate(...args)) as never)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    hydrate.fn.mockImplementation(async () => 'merged')
  })

  for (const outcome of ['succeeds', 'fails'] as const) {
    it(`(1) LATE AUTH, the late load ${outcome}: exactly one more real read restores the end state, never a third`, async () => {
      auth.state = { loading: true, user: null }
      const { result, rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
      expect(result.current.enabled).toBe(false)
      await act(async () => { vi.advanceTimersByTime(AUTH_WAIT_BOUND_MS); await flush() })
      expect(reads()).toEqual([A])
      await act(async () => { await answerReads() })
      expect(endState()).toEqual(CEE_VIEW)
      auth.state = { loading: false, user: { id: 'real-user' } }
      await act(async () => { rerender({ route: A }); await flush() })
      expect(result.current.enabled).toBe(false)
      expect(loads.map((l) => l.id)).toEqual([A])
      await act(async () => { if (outcome === 'succeeds') loads[0].resolve(true); else loads[0].reject(); await flush() })
      expect(result.current.enabled).toBe(true)
      expect(reads()).toEqual([A, A])
      await act(async () => { await answerReads() })
      // A late load that landed is fenced: CEE's values over the saved layout. One that failed changed nothing.
      expect(endState()).toEqual(outcome === 'succeeds' ? OVER_SUPABASE : CEE_VIEW)
      await act(async () => { rerender({ route: A }); vi.advanceTimersByTime(SUPABASE_LOAD_WAIT_BOUND_MS * 2); await flush() })
      expect(reads()).toEqual([A, A])
      expect(transportCallsFor(A)).toBe(2)
    })
  }

  it('(2) HUNG LOAD: the read waits for the bound, not a millisecond less; the late load is fenced by EXACTLY ONE more real read', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { result, rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
    await act(async () => { vi.advanceTimersByTime(SUPABASE_LOAD_WAIT_BOUND_MS - 1); await flush() })
    expect(result.current.enabled).toBe(false)
    expect(reads()).toEqual([])
    await act(async () => { vi.advanceTimersByTime(1); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([A])
    await act(async () => { await answerReads() })
    expect(endState()).toEqual(CEE_VIEW)
    // The late load lands; the fence's re-read is in flight and its answer held, so the state BETWEEN is observable.
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(reads()).toEqual([A, A])
    const between = endState()
    expect(between.identity).toBeNull()
    expect(between.runDelta).toBeNull()
    expect(between.nodes.every((n) => String(n.label).endsWith('(saved copy)'))).toBe(true)
    await act(async () => { await answerReads() })
    // DL condition: the END state is CEE's graph, identity and run delta over the saved layout, after exactly one extra read.
    expect(endState()).toEqual(OVER_SUPABASE)
    await act(async () => { rerender({ route: A }); vi.advanceTimersByTime(SUPABASE_LOAD_WAIT_BOUND_MS * 2); await flush() })
    expect(reads()).toEqual([A, A])
    expect(transportCallsFor(A)).toBe(2)
  })

  // The ORIGINAL A load stays pending across B and the fresh A, and settles inside each window in turn. A tracker that
  // settled by ROUTE alone would let it open the fresh A's gate (the window "during fresh A").
  for (const window of ['during pending B', 'during fresh A'] as const) {
    it(`(3) A→B→A, the original A settles ${window}: neither gate changes; only the fresh A's settle reads A, once`, async () => {
      auth.state = { loading: false, user: { id: 'real-user' } }
      const { result, rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
      expect(result.current.enabled).toBe(false)
      await act(async () => { rerender({ route: B }); await flush() })
      expect(result.current.enabled).toBe(false)
      if (window === 'during pending B') {
        await act(async () => { loads[0].resolve(false); await flush() })
        expect(result.current.enabled).toBe(false)
      }
      await act(async () => { rerender({ route: A }); await flush() })
      expect(loads.map((l) => l.id)).toEqual([A, B, A])
      expect(result.current.enabled).toBe(false)
      if (window === 'during fresh A') {
        await act(async () => { loads[0].resolve(false); await flush() })
        expect(result.current.enabled).toBe(false)
      }
      // B's load lands late (its own store write is useScenario's, outside this PR: DL "not blocking").
      await act(async () => { loads[1].resolve(false); await flush() })
      expect(result.current.enabled).toBe(false)
      expect(reads()).toEqual([])
      await act(async () => { loads[2].resolve(true); await flush() })
      expect(result.current.enabled).toBe(true)
      expect(reads()).toEqual([A])
      await act(async () => { await answerReads() })
      expect(endState()).toEqual(OVER_SUPABASE)
      expect(transportCallsFor(A)).toBe(1)
      expect(transportCallsFor(B)).toBe(0)
    })
  }

  it('ONCE PER EPOCH: a dependency change with no new epoch (the signed-in user changes on a settled route) reads nothing', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(reads()).toEqual([A])
    await act(async () => { await answerReads() })
    auth.state = { loading: false, user: { id: 'another-user' } }
    await act(async () => { rerender({ route: A }); await flush() })
    expect(reads()).toEqual([A])
    expect(endState()).toEqual(OVER_SUPABASE)
  })

  it('CONTROL: auth resolved before the bound waits for the load, reads ONCE, and ends on CEE over the saved layout', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { result } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
    expect(result.current.enabled).toBe(false)
    expect(reads()).toEqual([])
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([A])
    await act(async () => { await answerReads() })
    expect(endState()).toEqual(OVER_SUPABASE)
  })

  it('CONTROL: auth that never resolves releases ONE guest read and keeps CEE\'s view', async () => {
    auth.state = { loading: true, user: null }
    const { result } = renderHook(({ route }) => useHarness(route), { initialProps: { route: A } })
    await act(async () => { vi.advanceTimersByTime(AUTH_WAIT_BOUND_MS + SUPABASE_LOAD_WAIT_BOUND_MS); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([A])
    await act(async () => { await answerReads() })
    expect(endState()).toEqual(CEE_VIEW)
  })
})
