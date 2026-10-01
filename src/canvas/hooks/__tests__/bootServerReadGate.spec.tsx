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
 *       hydration hook receives `enabled`. Bound by the file's bytes.
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
import { AUTH_WAIT_BOUND_MS, serverReadEnabled, useBootServerReadEnabled } from '../useBootServerReadEnabled'
import { useServerGraphHydration } from '../useServerGraphHydration'

const ROUTE = '5f0c2a8e-1b7d-4c3e-9a64-0d2b8e7f1c35'

beforeEach(() => {
  auth.state = { loading: false, user: null }
  hydrate.fn.mockClear()
  useCanvasStore.setState({ currentScenarioId: null, nodes: [], edges: [], serverGraphIdentity: null } as never)
})
afterEach(() => vi.useRealTimers())

describe('B1 · the gate', () => {
  const base = { authLoading: false, authWaitExpired: false, isPersistenceActive: true, routeId: ROUTE, supabaseSettledFor: null }
  const rows: Array<[string, Partial<typeof base>, boolean]> = [
    ['auth loading holds every read', { authLoading: true }, false],
    ['a guest reads once auth resolves', { isPersistenceActive: false }, true],
    ['signed in, Supabase load not settled → wait', {}, false],
    ['signed in, settled for ANOTHER id → still wait', { supabaseSettledFor: 'another-id' }, false],
    ['signed in, settled for THIS id → read', { supabaseSettledFor: ROUTE }, true],
    ['signed in with no route id (no Supabase load runs) → read', { routeId: null }, true],
  ]
  for (const [name, over, want] of rows) it(name, () => expect(serverReadEnabled({ ...base, ...over })).toBe(want))
})

describe('B2 · auth that never resolves (DL row 1)', () => {
  it(`proceeds after ${AUTH_WAIT_BOUND_MS} ms, not before`, () => {
    vi.useFakeTimers()
    auth.state = { loading: true, user: null }
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { result } = renderHook(() => useBootServerReadEnabled(ROUTE, false, null))
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
  it('the Supabase load settles in `finally` (a failed load still releases the read)', () => {
    expect(src).toMatch(/\.finally\(\(\) => setSupabaseSettledFor\(id\)\)/)
  })
  it('the hydration hook receives the gate as `enabled`', () => {
    expect(src).toMatch(/useServerGraphHydration\(scenarioIdFromRoute, \{ enabled: serverReadEnabled \}\)/)
    expect(src).toMatch(/useBootServerReadEnabled\(scenarioIdFromRoute, isPersistenceActive, supabaseSettledFor\)/)
  })
})
