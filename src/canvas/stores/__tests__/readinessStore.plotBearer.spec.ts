/** Readiness carries the Supabase user's bearer, never the PLoT service credential. */
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { SESSION_READ_TIMEOUT_MS } from '../../conversation/turnLifecycle'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { getSessionIdentity, canvas } = vi.hoisted(() => ({
  getSessionIdentity: vi.fn(),
  canvas: { state: {} as Record<string, unknown> },
}))
vi.mock('../../../lib/supabase', () => ({ getSessionIdentity }))
vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: () => canvas.state,
    subscribe: () => () => {},
  },
}))

import { __test__ as storeTest, useReadinessStore } from '../readinessStore'
import { buildTurnAuthHeaders } from '../../../v5/turnAuthHeaders'
import { __test__ as dedupTest, clearInflightCache } from '../../hooks/useGraphReadiness'

function okReadiness() {
  return new Response(
    JSON.stringify({
      readiness_score: 75,
      readiness_level: 'ready', // ROADMAP 2.635 — was 'strong', the local heuristic's spelling of the top band; that heuristic is deleted and the level with it. `ready` is the producer's own top band at this score.
      can_run_analysis: true,
      confidence_explanation: 'Good',
      improvements: [],
    }),
    { status: 200 },
  )
}

let fetchSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  storeTest.resetModuleState()
  clearInflightCache()
  canvas.state = {
    nodes: [{ id: 'n1', type: 'factor', data: { label: 'A' } }],
    edges: [], graphHealth: null, ceeAnalysisReady: null, currentBriefText: null,
  }
  useReadinessStore.getState().reset()
  vi.stubGlobal('crypto', webcrypto)
  getSessionIdentity.mockResolvedValue({ userId: null, accessToken: null })
  fetchSpy = vi.fn().mockImplementation(() => Promise.resolve(okReadiness()))
  vi.stubGlobal('fetch', fetchSpy)
})

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.unstubAllEnvs()
  storeTest.resetModuleState()
  clearInflightCache()
  useReadinessStore.setState({ readiness: null, loading: false, error: null })
})

function headersOfFirstFetch(): Record<string, string> {
  const init = fetchSpy.mock.calls[0]?.[1] as RequestInit | undefined
  return (init?.headers ?? {}) as Record<string, string>
}

describe('readinessStore session bearer at the same-origin seam', () => {
  it('targets the literal /bff/cee seam (live path, not a dead constant)', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(String(fetchSpy.mock.calls[0]?.[0] ?? '')).toBe('/bff/cee/graph-readiness')
  })

  it('guest sends no Authorization even when VITE_PLOT_BEARER is set', async () => {
    vi.stubEnv('VITE_PLOT_BEARER', 'staging-token-abc')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).not.toHaveProperty('Authorization')
  })

  it('guest sends exactly the existing request headers', async () => {
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).toEqual({
      'Content-Type': 'application/json',
      'X-Request-ID': expect.any(String),
    })
  })

  it('signed-in readiness sends the exact Supabase bearer on the captured fetch', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: 'supabase-token-a' })
    vi.stubEnv('VITE_PLOT_BEARER', 'plot-service-token')

    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(headersOfFirstFetch()).toEqual({
      'Content-Type': 'application/json',
      'X-Request-ID': expect.any(String),
      'X-User-Id': 'owner-a',
      Authorization: 'Bearer supabase-token-a',
    })
    expect(getSessionIdentity).toHaveBeenCalledTimes(1)
  })

  it('the store rechecks the identical graph for a different identity', async () => {
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: 'token-a' })
    fetchSpy.mockImplementation(async (_url: string, init: RequestInit) => {
      const auth = new Headers(init.headers).get('Authorization')
      return new Response(JSON.stringify({
        readiness_score: 75, readiness_level: 'ready', can_run_analysis: true,
        confidence_explanation: auth, improvements: [],
      }), { status: 200 })
    })
    await storeTest.fetchReadiness()
    getSessionIdentity.mockResolvedValue({ userId: 'owner-b', accessToken: 'token-b' })
    await storeTest.fetchReadiness()

    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(useReadinessStore.getState().readiness?.confidence_explanation).toBe('Bearer token-b')
  })

  it('two identities cannot share an in-flight deduplicated response', async () => {
    const resolveFetches: Array<() => void> = []
    fetchSpy.mockImplementation((_url: string, init: RequestInit) => new Promise<Response>(resolve => {
      const auth = new Headers(init.headers).get('Authorization')
      resolveFetches.push(() => resolve(new Response(JSON.stringify({ auth }), { status: 200 })))
    }))
    const a = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'a',
      buildTurnAuthHeaders({ userId: 'owner-a', accessToken: 'token-a' }), 'opaque-a')
    const b = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'b',
      buildTurnAuthHeaders({ userId: 'owner-b', accessToken: 'token-b' }), 'opaque-b')
    resolveFetches.forEach(resolve => resolve())
    const [first, second] = await Promise.all([a.promise, b.promise])

    expect(second.data).toEqual({ auth: 'Bearer token-b' })
    expect(first.data).toEqual({ auth: 'Bearer token-a' })
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    expect(b.isReused).toBe(false)
  })

  it('the same identity still shares a deduplicated response', async () => {
    const headers = buildTurnAuthHeaders({ userId: 'owner-a', accessToken: 'token-a' })
    const a = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'a', headers, 'opaque-a')
    const b = dedupTest.deduplicatedFetch('/bff/cee/graph-readiness', '{}', 'b', headers, 'opaque-a')
    await Promise.all([a.promise, b.promise])

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(b.isReused).toBe(true)
    expect(b.promise).toBe(a.promise)
  })
})

function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>(r => { resolve = r })
  return { promise, resolve }
}
const identityA = { userId: 'owner-a', accessToken: 'token-a' }
const identityB = { userId: 'owner-b', accessToken: 'token-b' }

describe('readiness owner and lifecycle fence (round 2)', () => {
  it('A success → B 403: clears A before dispatch and retains no A verdict on failure', async () => {
    getSessionIdentity.mockResolvedValue(identityA)
    await storeTest.fetchReadiness()
    expect(useReadinessStore.getState().readiness).not.toBeNull()
    useReadinessStore.setState({ error: 'old owner error' })
    getSessionIdentity.mockResolvedValue(identityB)
    const refusal = deferred<Response>()
    let atDispatch: ReturnType<typeof useReadinessStore.getState> | undefined
    fetchSpy.mockImplementationOnce(() => {
      atDispatch = useReadinessStore.getState()
      return refusal.promise
    })
    const check = storeTest.fetchReadiness()
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    refusal.resolve(new Response('', { status: 403 }))
    await check
    expect(atDispatch?.readiness).toBeNull()
    expect(atDispatch?.error).toBeNull()
    expect(useReadinessStore.getState().readiness).toBeNull()
    expect(useReadinessStore.getState().verdictAtMs).toBeNull()
    expect(useReadinessStore.getState().error).toContain('HTTP 403')
  })

  it('control: A success → A 503 keeps A’s own server verdict', async () => {
    getSessionIdentity.mockResolvedValue(identityA)
    await storeTest.fetchReadiness()
    const verdict = useReadinessStore.getState().readiness
    canvas.state = { ...canvas.state, currentBriefText: 'A changed brief long enough for the payload' }
    fetchSpy.mockResolvedValueOnce(new Response('', { status: 503 }))
    await storeTest.fetchReadiness()
    expect(useReadinessStore.getState().readiness).toBe(verdict)
    expect(useReadinessStore.getState().error).toContain('HTTP 503')
  })

  it('held A read → teardown → remount B: late A never dispatches or clears B’s guard', async () => {
    const held = deferred<typeof identityA>()
    getSessionIdentity.mockReturnValueOnce(held.promise)
    const old = storeTest.fetchReadiness()
    await vi.waitFor(() => expect(getSessionIdentity).toHaveBeenCalledTimes(1))
    storeTest.resetModuleState()
    canvas.state = { ...canvas.state, nodes: [{ id: 'b-node', type: 'factor', data: { label: 'B' } }] }
    getSessionIdentity.mockResolvedValue(identityB)
    const bResponse = deferred<Response>()
    fetchSpy.mockImplementationOnce(() => bResponse.promise)
    const release = useReadinessStore.getState().startListening()
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    const bState = useReadinessStore.getState()
    expect(storeTest.getModuleState().fetchInFlight).toBe(true)
    held.resolve(identityA)
    await old
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(useReadinessStore.getState()).toBe(bState)
    expect(storeTest.getModuleState().fetchInFlight).toBe(true)
    bResponse.resolve(okReadiness())
    await vi.waitFor(() => expect(useReadinessStore.getState().loading).toBe(false))
    release()
  })

  it('teardown fences a dispatched response and its finally from a newer check', async () => {
    getSessionIdentity.mockResolvedValue(identityA)
    const aResponse = deferred<Response>()
    fetchSpy.mockImplementationOnce(() => aResponse.promise)
    const old = storeTest.fetchReadiness()
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(1))
    storeTest.resetModuleState()
    getSessionIdentity.mockResolvedValue(identityB)
    const bResponse = deferred<Response>()
    fetchSpy.mockImplementationOnce(() => bResponse.promise)
    const next = storeTest.fetchReadiness()
    await vi.waitFor(() => expect(fetchSpy).toHaveBeenCalledTimes(2))
    const bState = useReadinessStore.getState()
    aResponse.resolve(okReadiness())
    await old
    expect(useReadinessStore.getState()).toBe(bState)
    expect(storeTest.getModuleState().fetchInFlight).toBe(true)
    bResponse.resolve(okReadiness())
    await next
  })

  it('hung identity times out to recoverable unknown, releases the guard, and permits a next check', async () => {
    vi.useFakeTimers()
    const held = deferred<typeof identityA>()
    getSessionIdentity.mockReturnValueOnce(held.promise)
    const hung = storeTest.fetchReadiness()
    try {
      await vi.waitFor(() => expect(getSessionIdentity).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(SESSION_READ_TIMEOUT_MS + 1)
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(useReadinessStore.getState().readiness).toBeNull()
      expect(useReadinessStore.getState().error).toBe('Could not reach the readiness service')
      expect(storeTest.getModuleState().fetchInFlight).toBe(false)
      await hung
      getSessionIdentity.mockResolvedValue(identityB)
      await storeTest.fetchReadiness()
      const bState = useReadinessStore.getState()
      held.resolve(identityA)
      await vi.advanceTimersByTimeAsync(0)
      expect(fetchSpy).toHaveBeenCalledTimes(1)
      expect(useReadinessStore.getState()).toBe(bState)
    } finally {
      held.resolve(identityA)
      await hung
    }
  })

  it('a local placeholder cannot be adopted after teardown', async () => {
    canvas.state = { ...canvas.state, nodes: [] }
    await storeTest.fetchReadiness()
    expect(useReadinessStore.getState().readiness).not.toBeNull()
    storeTest.resetModuleState()
    expect(useReadinessStore.getState().readiness).toBeNull()
  })

  it('control: same-identity last-success reuse performs no refetch', async () => {
    getSessionIdentity.mockResolvedValue(identityA)
    await storeTest.fetchReadiness()
    const state = useReadinessStore.getState()
    await storeTest.fetchReadiness()
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(useReadinessStore.getState()).toBe(state)
  })

  it('dedup Map keys and last-success module key contain no raw bearer and distinguish rotated tokens', async () => {
    const token = 'private-long-supabase-token-for-key-test'
    const mapWrites = vi.spyOn(Map.prototype, 'set')
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: token })
    await storeTest.fetchReadiness()
    const keys = mapWrites.mock.calls.map(([key]) => key)
      .filter((key): key is string => typeof key === 'string' && key.includes('/bff/cee/graph-readiness'))
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.join('')).not.toContain(token)
    const module = storeTest.getModuleState() as ReturnType<typeof storeTest.getModuleState> & { lastAuthKey?: string | null }
    expect(module.lastAuthKey).toEqual(expect.any(String))
    expect(module.lastAuthKey).not.toContain(token)
    getSessionIdentity.mockResolvedValue({ userId: 'owner-a', accessToken: token + '-rotated' })
    await storeTest.fetchReadiness()
    expect(fetchSpy).toHaveBeenCalledTimes(2)
  })

  it('the existing auth-boundary sweep resets readiness and invalidates held work', async () => {
    getSessionIdentity.mockResolvedValue(identityA)
    await storeTest.fetchReadiness()
    const resetForAuth = (useReadinessStore.getState() as ReturnType<typeof useReadinessStore.getState> & { resetForAuth?: () => void }).resetForAuth
    expect(resetForAuth).toEqual(expect.any(Function))
    const held = deferred<typeof identityA>()
    getSessionIdentity.mockReturnValueOnce(held.promise)
    const old = storeTest.fetchReadiness()
    await vi.waitFor(() => expect(getSessionIdentity).toHaveBeenCalledTimes(2))
    const generation = storeTest.getModuleState() as { generation?: number }
    resetForAuth!()
    expect((storeTest.getModuleState() as { generation?: number }).generation).not.toBe(generation.generation)
    expect(useReadinessStore.getState().readiness).toBeNull()
    expect(useReadinessStore.getState().error).toBeNull()
    expect((storeTest.getModuleState() as { lastAuthKey?: string | null }).lastAuthKey).toBeNull()
    getSessionIdentity.mockResolvedValue(identityB)
    await storeTest.fetchReadiness()
    const bState = useReadinessStore.getState()
    held.resolve(identityA)
    await old
    expect(useReadinessStore.getState()).toBe(bState)
    expect(fetchSpy).toHaveBeenCalledTimes(2)
    const sweep = readFileSync('src/lib/auth/userScopedState.ts', 'utf8')
    expect(sweep).toContain('useReadinessStore.getState().resetForAuth()')
    expect(sweep.indexOf('useReadinessStore.getState().resetForAuth()')).toBeLessThan(sweep.indexOf('useCanvasStore.getState().resetCanvas()'))
  })
})
