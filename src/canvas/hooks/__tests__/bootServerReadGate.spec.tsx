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
 *       mirrors CanvasMVP (load tracker → gate → hydration hook), bound to the scenario id + `serverGraphIdentity`:
 *       (1) LATE AUTH (CODEX UI BUDDY 5939083741): auth after the bound → the guest-path read → the signed-in load wipes
 *           it → its settle (success OR failure) grants exactly ONE more read → restored; never a third.
 *       (2) HUNG LOAD: the wait releases at SUPABASE_LOAD_WAIT_BOUND_MS (not before); the late load wipes the graph →
 *           its settle grants exactly ONE more read (the fence) → restored.
 *       (3) A→B→A: B's late settle neither enables nor disables A; A's fresh load gates A until IT settles; then A is
 *           read again under the fresh generation.
 *       ONCE PER EPOCH: a dependency change with no new epoch reads nothing. CONTROLS (the buddy's): auth resolved
 *       before the bound reads once, after the load; auth that never resolves reads once and keeps its identity.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
vi.mock('../../hydrate/serverGraphHydration', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../hydrate/serverGraphHydration')>()),
  hydrateCanvasFromServer: (...args: unknown[]) => hydrate.fn(...(args as [])),
}))

import { useCanvasStore } from '../../store'
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

describe('B6 · round 2: one more read per load generation, never a stale one (DL 5939155228)', () => {
  const OTHER = '7a1d3c5e-2b4f-4d6a-8c9e-1f3b5d7a9c2e'
  const nodesFor = (id: string) => [{ id: `g-${id}`, type: 'goal', position: { x: 0, y: 0 }, data: { label: 'Goal' } }] as never
  const ceeIdentity = (id: string) => ({ value: `cee-${id}`, projectionVersion: 'v1' })
  const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve() }
  type Load = { id: string; resolve: (apply: boolean) => void; reject: () => void }
  let loads: Load[] = []
  // The real loadScenario's store effect: `hydrateGraphSlice` for the loaded id (which clears the decision context).
  const loadScenario = (id: string) =>
    new Promise<void>((res, rej) => {
      loads.push({
        id,
        resolve: (apply) => {
          if (apply) useCanvasStore.getState().hydrateGraphSlice({ nodes: nodesFor(id), edges: [], currentScenarioId: id, goalConstraints: null } as never)
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
  const identity = () => useCanvasStore.getState().serverGraphIdentity
  const scenario = () => useCanvasStore.getState().currentScenarioId

  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    loads = []
    hydrate.fn.mockImplementation((async (id: string) => {
      useCanvasStore.getState().setServerGraphIdentity(ceeIdentity(id))
      return 'merged'
    }) as never)
  })

  for (const outcome of ['succeeds', 'fails'] as const) {
    it(`(1) LATE AUTH, the late load ${outcome}: exactly one more read restores ${ROUTE.slice(0, 8)}'s identity, never a third`, async () => {
      auth.state = { loading: true, user: null }
      const { result, rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
      expect(result.current.enabled).toBe(false)
      await act(async () => { vi.advanceTimersByTime(AUTH_WAIT_BOUND_MS); await flush() })
      expect(reads()).toEqual([ROUTE])
      expect(identity()).toEqual(ceeIdentity(ROUTE))
      auth.state = { loading: false, user: { id: 'real-user' } }
      await act(async () => { rerender({ route: ROUTE }); await flush() })
      expect(result.current.enabled).toBe(false)
      expect(loads.map((l) => l.id)).toEqual([ROUTE])
      await act(async () => { if (outcome === 'succeeds') loads[0].resolve(true); else loads[0].reject(); await flush() })
      expect(result.current.enabled).toBe(true)
      expect(reads()).toEqual([ROUTE, ROUTE])
      expect(scenario()).toBe(ROUTE)
      expect(identity()).toEqual(ceeIdentity(ROUTE))
      await act(async () => { rerender({ route: ROUTE }); vi.advanceTimersByTime(SUPABASE_LOAD_WAIT_BOUND_MS * 2); await flush() })
      expect(reads()).toEqual([ROUTE, ROUTE])
    })
  }

  it('(2) HUNG LOAD: the read waits for the bound, not a millisecond less; the late load is fenced by ONE more read', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { result } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
    await act(async () => { vi.advanceTimersByTime(SUPABASE_LOAD_WAIT_BOUND_MS - 1); await flush() })
    expect(result.current.enabled).toBe(false)
    expect(reads()).toEqual([])
    await act(async () => { vi.advanceTimersByTime(1); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([ROUTE])
    expect(identity()).toEqual(ceeIdentity(ROUTE))
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(reads()).toEqual([ROUTE, ROUTE])
    expect(scenario()).toBe(ROUTE)
    expect(identity()).toEqual(ceeIdentity(ROUTE))
  })

  it('(3) A→B→A: B\'s late settle changes nothing; A\'s fresh load gates A until IT settles; then A is read again', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { result, rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(reads()).toEqual([ROUTE])
    expect(identity()).toEqual(ceeIdentity(ROUTE))
    await act(async () => { rerender({ route: OTHER }); await flush() })
    expect(result.current.enabled).toBe(false)
    await act(async () => { rerender({ route: ROUTE }); await flush() })
    expect(loads.map((l) => l.id)).toEqual([ROUTE, OTHER, ROUTE])
    expect(result.current.enabled).toBe(false)
    // B's load lands late (its own store write is useScenario's, outside this PR: DL "not blocking").
    await act(async () => { loads[1].resolve(false); await flush() })
    expect(result.current.enabled).toBe(false)
    expect(reads()).toEqual([ROUTE])
    await act(async () => { loads[2].resolve(true); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([ROUTE, ROUTE])
    expect(scenario()).toBe(ROUTE)
    expect(identity()).toEqual(ceeIdentity(ROUTE))
  })

  it('ONCE PER EPOCH: a dependency change with no new epoch (the signed-in user changes on a settled route) reads nothing', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { rerender } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(reads()).toEqual([ROUTE])
    auth.state = { loading: false, user: { id: 'another-user' } }
    await act(async () => { rerender({ route: ROUTE }); await flush() })
    expect(reads()).toEqual([ROUTE])
  })

  it('CONTROL: auth resolved before the bound waits for the load, reads ONCE, and the identity survives', async () => {
    auth.state = { loading: false, user: { id: 'real-user' } }
    const { result } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
    expect(result.current.enabled).toBe(false)
    expect(reads()).toEqual([])
    await act(async () => { loads[0].resolve(true); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([ROUTE])
    expect(identity()).toEqual(ceeIdentity(ROUTE))
  })

  it('CONTROL: auth that never resolves releases ONE guest read and keeps its identity', async () => {
    auth.state = { loading: true, user: null }
    const { result } = renderHook(({ route }) => useHarness(route), { initialProps: { route: ROUTE } })
    await act(async () => { vi.advanceTimersByTime(AUTH_WAIT_BOUND_MS + SUPABASE_LOAD_WAIT_BOUND_MS); await flush() })
    expect(result.current.enabled).toBe(true)
    expect(reads()).toEqual([ROUTE])
    expect(identity()).toEqual(ceeIdentity(ROUTE))
  })
})
